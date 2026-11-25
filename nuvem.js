// Ligação do app com o Supabase: login da equipe e banco de dados compartilhado.
// Oferece ao app a mesma forma de acesso usada na versão 1.0
// (collection(...).doc(...).set/update/delete e onSnapshot), guardando tudo no Supabase.
(function () {
  "use strict";
  const CFG = window.PM_CONFIG || {};
  const TABELAS = ["pedidos", "clientes", "config"];
  let sb = null;

  function erroDoSupabase(e) {
    const err = new Error((e && e.message) || "Erro no servidor");
    err.code = e && (e.code === "42501" || /row-level security/i.test(e.message || "")) ? "invalid_argument" : (e && e.code) || "erro";
    return err;
  }

  // ---------- banco no formato que o app já usa ----------
  function criarDb() {
    const ouvintes = Object.fromEntries(TABELAS.map(t => [t, new Set()]));
    const cache = Object.fromEntries(TABELAS.map(t => [t, null]));
    const canais = {};

    async function carregar(tabela) {
      const linhas = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from(tabela).select("id,data").order("id").range(de, de + 999);
        if (error) throw erroDoSupabase(error);
        linhas.push(...data);
        if (data.length < 1000) break;
      }
      cache[tabela] = new Map(linhas.map(r => [r.id, r.data || {}]));
      avisar(tabela);
    }

    function avisar(tabela) {
      const mapa = cache[tabela];
      if (!mapa) return;
      ouvintes[tabela].forEach(o => { try { o(mapa); } catch (e) { console.error(e); } });
    }

    function aplicarMudanca(tabela, msg) {
      const mapa = cache[tabela];
      if (!mapa) return;
      if (msg.eventType === "DELETE") mapa.delete(msg.old && msg.old.id);
      else if (msg.new && msg.new.id) mapa.set(msg.new.id, msg.new.data || {});
      avisar(tabela);
    }

    function ouvir(tabela, fn, falha) {
      ouvintes[tabela].add(fn);
      if (cache[tabela]) fn(cache[tabela]);
      if (!canais[tabela]) {
        canais[tabela] = sb.channel("pm-" + tabela)
          .on("postgres_changes", { event: "*", schema: "public", table: tabela }, msg => aplicarMudanca(tabela, msg))
          .subscribe(status => { if (status === "SUBSCRIBED") carregar(tabela).catch(() => {}); });
        carregar(tabela).catch(e => { if (falha) falha(e); });
      }
      return () => ouvintes[tabela].delete(fn);
    }

    // Quando o celular volta do segundo plano ou a internet volta, busca tudo de novo
    const recarregarTudo = () => TABELAS.forEach(t => { if (canais[t]) carregar(t).catch(() => {}); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recarregarTudo(); });
    window.addEventListener("online", recarregarTudo);

    function docRef(tabela, id) {
      return {
        async set(body) {
          const { error } = await sb.from(tabela).upsert({ id, data: body });
          if (error) throw erroDoSupabase(error);
          if (cache[tabela]) { cache[tabela].set(id, body); avisar(tabela); }
        },
        async update(patch) {
          const { error } = await sb.rpc("mesclar_documento", { tabela, doc_id: id, campos: patch });
          if (error) throw erroDoSupabase(error);
          if (cache[tabela] && cache[tabela].has(id)) { cache[tabela].set(id, { ...cache[tabela].get(id), ...patch }); avisar(tabela); }
        },
        async delete() {
          const { error } = await sb.from(tabela).delete().eq("id", id);
          if (error) throw erroDoSupabase(error);
          if (cache[tabela]) { cache[tabela].delete(id); avisar(tabela); }
        },
        onSnapshot(cb, falha) {
          return ouvir(tabela, mapa => {
            const d = mapa.get(id);
            cb({ exists: !!d, id, data: () => d });
          }, falha);
        },
      };
    }

    return {
      collection(tabela) {
        return {
          doc: id => docRef(tabela, id),
          onSnapshot(cb, falha) {
            return ouvir(tabela, mapa => {
              cb({ docs: [...mapa].map(([id, d]) => ({ id, data: () => d })), metadata: { fromCache: false } });
            }, falha);
          },
        };
      },
      doc(caminho) { const [tabela, id] = caminho.split("/"); return docRef(tabela, id); },
    };
  }

  // ---------- tela de entrada ----------
  function pedirLogin() {
    return new Promise(resolve => {
      const tela = document.getElementById("login");
      const form = document.getElementById("login-form");
      const email = document.getElementById("login-email");
      const senha = document.getElementById("login-senha");
      const senha2 = document.getElementById("login-senha2");
      const senha2Wrap = document.getElementById("login-senha2-wrap");
      const msg = document.getElementById("login-msg");
      const btn = document.getElementById("login-btn");
      const modoBtn = document.getElementById("login-modo");
      const sub = document.getElementById("login-sub");
      let criando = false;

      const setModo = c => {
        criando = c; msg.textContent = ""; msg.className = "aviso";
        senha2Wrap.hidden = !c; senha2.required = c;
        senha.autocomplete = c ? "new-password" : "current-password";
        btn.textContent = c ? "Criar senha e entrar" : "Entrar";
        sub.textContent = c ? "Use o e-mail cadastrado para a loja e escolha uma senha com pelo menos 8 caracteres." : "Entre com seu e-mail e senha.";
        modoBtn.textContent = c ? "Já tenho senha" : "Primeiro acesso? Crie sua senha";
      };
      modoBtn.onclick = () => setModo(!criando);
      tela.hidden = false;
      setTimeout(() => email.focus(), 50);

      form.onsubmit = async ev => {
        ev.preventDefault();
        msg.textContent = ""; msg.className = "aviso";
        const e = email.value.trim().toLowerCase(), s = senha.value;
        if (criando && s !== senha2.value) { msg.textContent = "As duas senhas estão diferentes."; return; }
        btn.disabled = true;
        try {
          if (criando) {
            const r = await sb.auth.signUp({ email: e, password: s });
            if (r.error) {
              if (/already|registered|exists/i.test(r.error.message)) throw new Error("Esse e-mail já tem senha. Toque em \"Já tenho senha\" para entrar.");
              if (/acesso|database error/i.test(r.error.message)) throw new Error("Esse e-mail não tem acesso ao app da Papel & Magia.");
              if (/password/i.test(r.error.message)) throw new Error("Escolha uma senha mais forte, com pelo menos 8 caracteres.");
              throw r.error;
            }
          }
          const { data, error } = await sb.auth.signInWithPassword({ email: e, password: s });
          if (error) {
            if (/invalid/i.test(error.message)) throw new Error("E-mail ou senha incorretos.");
            throw error;
          }
          tela.hidden = true; senha.value = ""; senha2.value = "";
          resolve(data.session);
        } catch (err) {
          msg.textContent = navigator.onLine === false ? "Sem internet. Conecte-se para entrar." : (err && err.message && !/fetch/i.test(err.message) ? err.message : "Não foi possível entrar. Tente de novo.");
        } finally { btn.disabled = false; }
      };
    });
  }

  async function conectar() {
    if (!window.supabase || !CFG.url || !CFG.chave) return null;
    sb = window.supabase.createClient(CFG.url, CFG.chave, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "pm-pedidos-sessao" } });
    let { data } = await sb.auth.getSession();
    if (!data.session) await pedirLogin();
    sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.reload(); });
    const sair = document.getElementById("btn-sair");
    if (sair) sair.onclick = async () => { await sb.auth.signOut(); location.reload(); };
    return criarDb();
  }

  window.PMNuvem = { conectar };
})();
