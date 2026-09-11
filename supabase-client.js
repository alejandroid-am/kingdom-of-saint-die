/* ===================================================================
   KINGDOM OF SAINT-DIÉ — cliente Supabase
   -------------------------------------------------------------------
   Se carga SOLO si hay credenciales (SUPABASE_URL + SUPABASE_ANON_KEY
   en kingdom-of-saint-die.html). Sin credenciales, la app corre en
   modo local y este fichero no se toca.

   La clave anon es pública por diseño: lo que protege los datos son
   las políticas RLS de schema.sql, no esconder la clave.

   Expone window.KSD con una API pequeña que usa la app:
     await KSD.ready()                     -> {user, profile}
     KSD.onAuth(cb)                         -> cb({user, profile} | null)
     await KSD.signIn(email, password)
     await KSD.signOut()
     await KSD.prosperity()                -> número
     await KSD.deeds()                     -> [{id,user_id,task_id,stat,points,created_at}]
     await KSD.board()                     -> [filas de board sin cerrar]
     await KSD.messages()                  -> [{id,from_user,kind,payload_id,deed_id,created_at}]
     await KSD.profiles()                  -> {<id>: {name,lang,avatar,mood_id}}
     await KSD.addDeed(task_id, stat, points) -> fila insertada
     await KSD.addBoard(text, stat, points)
     await KSD.closeBoard(id)
     await KSD.addMessage(kind, payload_id, deed_id?)
     await KSD.setMood(mood_id)
     await KSD.setLang(lang)
     KSD.subscribe(cb)                     -> cb({table, eventType, new, old}); llámalo para refrescar
   =================================================================== */
(function () {
  "use strict";
  const URL = window.SUPABASE_URL, KEY = window.SUPABASE_ANON_KEY;
  if (!URL || !KEY) return; // modo local: nada que hacer

  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

  let sb = null;
  let session = null;
  let profile = null;
  const authCbs = [];
  const subCbs = [];
  let readyResolve;
  const readyPromise = new Promise((r) => (readyResolve = r));

  async function boot() {
    const mod = await import(CDN);
    sb = mod.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session) await loadProfile();

    sb.auth.onAuthStateChange(async (_evt, s) => {
      session = s;
      profile = null;
      if (session) await loadProfile();
      const payload = session ? { user: session.user, profile } : null;
      authCbs.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
    });

    if (session) subscribeRealtime();
    readyResolve({ user: session && session.user, profile });
  }

  async function loadProfile() {
    if (!session) return;
    const { data, error } = await sb
      .from("profiles").select("*").eq("id", session.user.id).single();
    if (!error) profile = data;
  }

  function subscribeRealtime() {
    const ch = sb.channel("kingdom");
    ["deeds", "board", "messages", "profiles"].forEach((table) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, (p) => {
        subCbs.forEach((cb) => {
          try { cb({ table, eventType: p.eventType, new: p.new, old: p.old }); }
          catch (e) { console.error(e); }
        });
      });
    });
    ch.subscribe();
  }

  window.KSD = {
    ready: () => readyPromise,
    onAuth: (cb) => { authCbs.push(cb); if (session) cb({ user: session.user, profile }); },
    subscribe: (cb) => { subCbs.push(cb); },

    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signOut: () => sb.auth.signOut(),
    currentUserId: () => session && session.user.id,

    async prosperity() {
      const { data } = await sb.from("prosperity").select("total").single();
      return (data && data.total) || 0;
    },
    async deeds() {
      const { data } = await sb.from("deeds").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    async board() {
      const { data } = await sb.from("board").select("*").is("done_at", null).order("created_at");
      return data || [];
    },
    async messages() {
      const { data } = await sb.from("messages").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    async profiles() {
      const { data } = await sb.from("profiles").select("*");
      const map = {};
      (data || []).forEach((p) => (map[p.id] = p));
      return map;
    },

    addDeed: (task_id, stat, points) =>
      sb.from("deeds").insert({ task_id, stat, points }).select().single(),
    addBoard: (text, stat, points) =>
      sb.from("board").insert({ text, stat, points }).select().single(),
    closeBoard: (id) =>
      sb.from("board").update({ done_by: session.user.id, done_at: new Date().toISOString() }).eq("id", id),
    addMessage: (kind, payload_id, deed_id) =>
      sb.from("messages").insert({ kind, payload_id, deed_id: deed_id || null }).select().single(),
    setMood: (mood_id) =>
      sb.from("profiles").update({ mood_id, mood_at: new Date().toISOString() }).eq("id", session.user.id),
    setLang: (lang) =>
      sb.from("profiles").update({ lang }).eq("id", session.user.id),
  };

  boot().catch((e) => {
    console.error("KSD backend init failed:", e);
    window.KSD_BACKEND = "local"; // degradar con elegancia
  });
})();
