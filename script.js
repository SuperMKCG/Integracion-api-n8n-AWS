// Ajusta aquí la URL de tu webhook de n8n (producción)
const N8N_WEBHOOK = "https://suerick.app.n8n.cloud/webhook/capturar-operacion";

const form = document.getElementById("mathForm");
const desc = document.getElementById("description");
const expr = document.getElementById("expression");
const resultCard = document.getElementById("resultCard");
const resultValue = document.getElementById("resultValue");
const resultExpr = document.getElementById("resultExpr");
const historyList = document.getElementById("historyList");

async function getPublicIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (!r.ok) return "0.0.0.0";
    const j = await r.json();
    return j.ip || "0.0.0.0";
  } catch {
    return "0.0.0.0";
  }
}

function showResult(operation, value) {
  resultCard.classList.remove("hidden");
  resultValue.textContent = value;
  resultExpr.textContent = operation;
}

function addHistory(descText, operation, value, ok=true) {
  const li = document.createElement("li");
  li.innerHTML = `<div><strong>${descText || operation}</strong><div class="muted">${operation}</div></div><div>${ok ? value : "ERROR"}</div>`;
  historyList.prepend(li);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const operation = expr.value.trim();
  const description = desc.value.trim();

  if (!operation) {
    alert("Ingresa una operación.");
    return;
  }

  resultCard.classList.add("hidden");
  resultValue.textContent = "Procesando...";

  try {
    const ip = await getPublicIP();

    // Enviar a n8n (este hará OpenAI + guardado en RDS)
    const resp = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operacion: operation, ip: ip })
    });

    // Si n8n responde con no content -> fallará parse
    if (!resp.ok) {
      throw new Error(`Error en n8n: ${resp.status}`);
    }

    const data = await resp.json();

    if (!data || typeof data.resultado === "undefined") {
      throw new Error("Respuesta inválida del servidor");
    }

    showResult(operation, data.resultado);
    addHistory(description, operation, data.resultado, true);
  } catch (err) {
    resultCard.classList.remove("hidden");
    resultValue.textContent = "Error";
    resultExpr.textContent = err.message;
    addHistory(description, operation, err.message, false);
  }
});
