// script.js — versión para uso con n8n + OpenAI
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("mathForm");
  const desc = document.getElementById("description");
  const expr = document.getElementById("expression");
  const resultCard = document.getElementById("resultCard");
  const resultValue = document.getElementById("resultValue");
  const resultExpr = document.getElementById("resultExpr");
  const historyList = document.getElementById("historyList");
  const clearBtn = document.getElementById("clearBtn");

  /* ***************************************
     Obtener IP del cliente
     *************************************** */
  let clientIP = "0.0.0.0";

  fetch("https://api.ipify.org?format=json")
    .then(res => res.json())
    .then(data => clientIP = data.ip)
    .catch(() => clientIP = "0.0.0.0");

  /* ***************************************
     Mostrar resultado
     *************************************** */
  function showResult(expression, value) {
    resultExpr.textContent = expression;
    resultValue.textContent = value;
    resultCard.classList.remove("d-none", "alert-danger");
    resultCard.classList.add("alert-success");
  }

  /* ***************************************
     Mostrar error
     *************************************** */
  function showError(msg) {
    resultExpr.textContent = "";
    resultValue.textContent = msg;
    resultCard.classList.remove("d-none", "alert-success");
    resultCard.classList.add("alert-danger");
  }

  /* ***************************************
     Agregar al historial
     *************************************** */
  function addHistory(text, expression, value, ok = true) {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-start";
    li.innerHTML = `
      <div class="ms-2 me-auto">
        <div class="fw-bold">${escapeHtml(text)}</div>
        <code>${escapeHtml(expression)}</code>
      </div>
      <span class="badge ${ok ? "bg-success" : "bg-danger"} rounded-pill">
        ${ok ? value : "ERROR"}
      </span>
    `;
    historyList.prepend(li);
  }

  /* ***************************************
     Limpiar formulario
     *************************************** */
  clearBtn.addEventListener("click", () => {
    desc.value = "";
    expr.value = "";
    resultCard.classList.add("d-none");
  });

  /* ***************************************
     Submit del formulario
     *************************************** */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!desc.value.trim()) {
      desc.classList.add("is-invalid");
      return;
    } else desc.classList.remove("is-invalid");

    if (!expr.value.trim()) {
      expr.classList.add("is-invalid");
      return;
    } else expr.classList.remove("is-invalid");

    const expression = expr.value.trim();
    const descripcion = desc.value.trim();

    try {
      /* ====================================================
         ENVIAR A n8n (OpenAI resolverá la operación)
         ==================================================== */
      const response = await fetch(
        "https://supermkcg.app.n8n.cloud/webhook/capturar-operacion",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ip: clientIP,
            operacion: expression
          })
        }
      );

      const data = await response.json();

      if (!data || !data.resultado) {
        showError("Error en la respuesta del servidor.");
        addHistory(descripcion, expression, "ERROR", false);
        return;
      }

      const resultado = data.resultado;

      // Mostrar
      showResult(expression, resultado);

      // Historial
      addHistory(descripcion, expression, resultado, true);

    } catch (err) {
      showError("Error: " + err.message);
      addHistory(descripcion, expression, err.message, false);
    }
  });

  /* ***************************************
     Utilidad: escapar HTML
     *************************************** */
  function escapeHtml(s) {
    return s.replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#47;', '=': '&#61;', '`': '&#96;'
      }[c];
    });
  }
});
