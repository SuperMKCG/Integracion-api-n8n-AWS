// script.js
// Evaluador matemático (tokenize -> shunting-yard -> RPN evaluate).
// Soporta: + - * / ^, paréntesis, números decimales, funciones: sin, cos, tan, sqrt, log, abs, pow

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('mathForm');
  const desc = document.getElementById('description');
  const expr = document.getElementById('expression');
  const resultCard = document.getElementById('resultCard');
  const resultValue = document.getElementById('resultValue');
  const resultExpr = document.getElementById('resultExpr');
  const historyList = document.getElementById('historyList');
  const clearBtn = document.getElementById('clearBtn');

  function showResult(expression, value) {
    resultExpr.textContent = expression;
    resultValue.textContent = value;
    resultCard.classList.remove('d-none', 'alert-danger');
    resultCard.classList.add('alert-success');
  }

  function showError(msg) {
    resultExpr.textContent = msg;
    resultValue.textContent = '';
    resultCard.classList.remove('d-none', 'alert-success');
    resultCard.classList.add('alert-danger');
  }

  function addHistory(text, expression, value, ok = true) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div class="ms-2 me-auto">
        <div class="fw-bold">${escapeHtml(text)}</div>
        <code>${escapeHtml(expression)}</code>
      </div>
      <span class="badge ${ok ? 'bg-success' : 'bg-danger'} rounded-pill">${ok ? value : 'ERROR'}</span>
    `;
    historyList.prepend(li);
  }

  clearBtn.addEventListener('click', () => {
    desc.value = '';
    expr.value = '';
    resultCard.classList.add('d-none');
  });

  /* *********************************************
     🔵 Obtener IP pública desde el navegador
     ********************************************* */
  let clientIP = "0.0.0.0";

  fetch("https://api.ipify.org?format=json")
    .then(res => res.json())
    .then(data => { clientIP = data.ip; })
    .catch(() => { clientIP = "0.0.0.0"; });

  /* *********************************************
     🔵 Evento SUBMIT del formulario
     ********************************************* */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // simple bootstrap validation
    if (!desc.value.trim()) {
      desc.classList.add('is-invalid');
      return;
    } else desc.classList.remove('is-invalid');

    if (!expr.value.trim()) {
      expr.classList.add('is-invalid');
      return;
    } else expr.classList.remove('is-invalid');

    const expression = expr.value.trim();

    try {
      const value = evaluateExpression(expression);
      showResult(expression, value);
      addHistory(desc.value.trim(), expression, String(value), true);

      /* ============================================
         🔵 ENVÍO AL WEBHOOK DE N8N
         ============================================ */
      fetch("https://supermkcg.app.n8n.cloud/webhook/capturar-operacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: clientIP,
          operacion: expression,
          resultado: String(value)
        })
      })
      .then(r => r.json().catch(() => null))
      .then(data => console.log("✔ Enviado a n8n:", data))
      .catch(err => console.error("❌ Error enviando a n8n:", err));

    } catch (err) {
      showError('Error: ' + err.message);
      addHistory(desc.value.trim(), expression, err.message, false);
    }
  });

  /* ***********************************
     Utility: escape HTML
     *********************************** */
  function escapeHtml(s) {
    return s.replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;','=':'&#61;', '`':'&#96;'
      }[c];
    });
  }

  /*******************************
   * Math evaluator implementation
   *******************************/

  const FUNCTIONS = new Set(['sin','cos','tan','sqrt','log','abs','pow']);
  const OPERATORS = {
    '+': { prec: 2, assoc: 'L' },
    '-': { prec: 2, assoc: 'L' },
    '*': { prec: 3, assoc: 'L' },
    '/': { prec: 3, assoc: 'L' },
    '^': { prec: 4, assoc: 'R' }
  };

  function isNumericToken(t) {
    return /^-?\d+(\.\d+)?$/.test(t);
  }

  function tokenize(s) {
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }

      // number (including decimal)
      if (/\d|\./.test(ch)) {
        let num = ch; i++;
        while (i < s.length && /[\d.]/.test(s[i])) { num += s[i++]; }
        if ((num.match(/\./g) || []).length > 1) throw new Error('Número inválido: ' + num);
        tokens.push(num);
        continue;
      }

      // identifier/functions
      if (/[a-zA-Z]/.test(ch)) {
        let id = ch; i++;
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) { id += s[i++]; }
        tokens.push(id.toLowerCase());
        continue;
      }

      // operators or parens
      if ('+-*/^(),'.includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      throw new Error('Caracter no soportado: ' + ch);
    }
    return tokens;
  }

  function toRPN(tokens) {
    const output = [];
    const ops = [];

    for (let i=0;i<tokens.length;i++) {
      const token = tokens[i];

      if (isNumericToken(token)) {
        output.push(token);
        continue;
      }

      if (FUNCTIONS.has(token)) {
        ops.push(token);
        continue;
      }

      if (token === ',') {
        while (ops.length && ops[ops.length-1] !== '(') {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error('Separador fuera de lugar.');
        continue;
      }

      if (token in OPERATORS) {
        const prev = i === 0 ? null : tokens[i-1];
        const isUnaryMinus = token === '-' && (
          prev === null ||
          (prev in OPERATORS) ||
          prev === '(' ||
          prev === ','
        );
        if (isUnaryMinus) {
          ops.push('u-');
          continue;
        }

        while (ops.length) {
          const top = ops[ops.length-1];
          if (top in OPERATORS) {
            const o1 = OPERATORS[token], o2 = OPERATORS[top];
            if ((o1.assoc === 'L' && o1.prec <= o2.prec) ||
                (o1.assoc === 'R' && o1.prec < o2.prec)) {
              output.push(ops.pop());
              continue;
            }
          }
          break;
        }
        ops.push(token);
        continue;
      }

      if (token === '(') {
        ops.push(token);
        continue;
      }

      if (token === ')') {
        let found = false;
        while (ops.length) {
          const t = ops.pop();
          if (t === '(') { found = true; break; }
          output.push(t);
        }
        if (!found) throw new Error('Paréntesis desbalanceados.');
        if (ops.length && FUNCTIONS.has(ops[ops.length-1])) {
          output.push(ops.pop());
        }
        continue;
      }
    }

    while (ops.length) {
      const t = ops.pop();
      if (t === '(' || t === ')') throw new Error('Paréntesis desbalanceados.');
      output.push(t);
    }
    return output;
  }

  function evalRPN(rpn) {
    const stack = [];
    for (const token of rpn) {
      if (isNumericToken(token)) {
        stack.push(parseFloat(token));
        continue;
      }

      if (token === 'u-') {
        if (!stack.length) throw new Error('Argumento faltante para unary -');
        stack.push(-stack.pop());
        continue;
      }

      if (token in OPERATORS) {
        if (stack.length < 2) throw new Error('Argumentos insuficientes para operador ' + token);
        const b = stack.pop(), a = stack.pop();
        switch (token) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/':
            if (b === 0) throw new Error('División por cero');
            stack.push(a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
        continue;
      }

      if (FUNCTIONS.has(token)) {
        if (token === 'pow') {
          if (stack.length < 2) throw new Error('pow requiere 2 argumentos');
          const exp = stack.pop(), base = stack.pop();
          stack.push(Math.pow(base, exp));
          continue;
        } else {
          if (!stack.length) throw new Error('Argumento faltante para función ' + token);
          const v = stack.pop();
          switch (token) {
            case 'sin': stack.push(Math.sin(v)); break;
            case 'cos': stack.push(Math.cos(v)); break;
            case 'tan': stack.push(Math.tan(v)); break;
            case 'sqrt':
              if (v < 0) throw new Error('sqrt de número negativo');
              stack.push(Math.sqrt(v)); break;
            case 'log':
              if (v <= 0) throw new Error('log de número no positivo');
              stack.push(Math.log(v)); break;
            case 'abs': stack.push(Math.abs(v)); break;
          }
          continue;
        }
      }

      if (token === 'ln') {
        if (!stack.length) throw new Error('Argumento faltante para ln');
        const v = stack.pop();
        if (v <= 0) throw new Error('ln de número no positivo');
        stack.push(Math.log(v));
        continue;
      }

      throw new Error('Token desconocido: ' + token);
    }

    if (stack.length !== 1) throw new Error('Expresión inválida');
    return stack[0];
  }

  function evaluateExpression(s) {
    const tokens = tokenize(s);
    const rpn = toRPN(tokens);
    const result = evalRPN(rpn);
    const rounded = Math.abs(result) < 1e-12 ? 0 : Number.parseFloat(result.toPrecision(12));
    return rounded;
  }
});
