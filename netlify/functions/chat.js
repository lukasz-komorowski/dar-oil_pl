// =============================================================================
// Netlify Function: chat.js
// -----------------------------------------------------------------------------
// Cel: bezpieczny "pośrednik" między czatem na stronie (asystent-demo.html)
// a Anthropic API. Klucz API leży TYLKO w zmiennych środowiskowych Netlify
// i nigdy nie jest widoczny w kodzie front-end / przeglądarce użytkownika.
//
// Endpoint po wdrożeniu: https://twojadomena.pl/.netlify/functions/chat
// =============================================================================

exports.handler = async function (event) {
  // Tylko POST – wszystko inne odrzucamy
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Klucz API czytany ze zmiennej środowiskowej Netlify (Site settings →
  // Environment variables → ANTHROPIC_API_KEY). NIGDY nie wpisuj klucza
  // tutaj na sztywno.
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Brak skonfigurowanego klucza API na serwerze (ANTHROPIC_API_KEY).",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Nieprawidłowy JSON w zapytaniu." }),
    };
  }

  const { messages, system } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Brak wiadomości (messages) w zapytaniu." }),
    };
  }

  // Prosty limit bezpieczeństwa: nie przepuszczamy gigantycznych historii
  // (ochrona kosztowa — ktoś mógłby próbować zalać funkcję dużym payloadem)
  if (messages.length > 30) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Za długa historia rozmowy." }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: system || "",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Błąd Anthropic API", details: errText }),
      };
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const reply = textBlock ? textBlock.text : "Przepraszam, nie udało się przetworzyć odpowiedzi.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Błąd serwera", details: String(err) }),
    };
  }
};
