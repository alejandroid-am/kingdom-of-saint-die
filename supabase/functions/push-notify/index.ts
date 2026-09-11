/* ===================================================================
   Kingdom of Saint-Dié — función de servidor: envía notificaciones push
   -------------------------------------------------------------------
   La dispara un Database Webhook de Supabase en cada INSERT/UPDATE
   relevante. Lee la suscripción push de LA OTRA persona (nunca la de
   quien hizo la acción) con la clave de servicio, y le manda un aviso
   ya en SU idioma. Los catálogos de abajo son una copia exacta de los
   de index.html (tareas, ánimos, mensajes) — si cambias esos textos en
   la app, vuelve a generar este fichero para que las notificaciones
   sigan diciendo lo mismo.
   =================================================================== */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC   = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE  = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT  = Deno.env.get("VAPID_SUBJECT") || "mailto:nadie@example.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Copia exacta de los catálogos de textos de index.html (ver nota arriba)
const CAT = {"STATS":{"hogar":{"icon":"🏠","es":"Hogar","fr":"Foyer","en":"Home"},"vitalidad":{"icon":"💪","es":"Vitalidad","fr":"Vitalité","en":"Vitality"},"mente":{"icon":"📚","es":"Mente","fr":"Esprit","en":"Mind"},"alegria":{"icon":"✨","es":"Alegría","fr":"Joie","en":"Joy"},"union":{"icon":"💞","es":"Unión","fr":"Lien","en":"Bond"},"jardin":{"icon":"🌿","es":"Jardín","fr":"Jardin","en":"Garden"}},"TASKS":[{"id":"aspirar","icon":"🧹","pts":4,"stat":"hogar","es":"Aspirar","fr":"Passer l'aspirateur","en":"Vacuum"},{"id":"lavar","icon":"🧺","pts":3,"stat":"hogar","es":"Lavar ropa","fr":"Faire la lessive","en":"Laundry"},{"id":"tender","icon":"👕","pts":2,"stat":"hogar","es":"Tender ropa","fr":"Étendre le linge","en":"Hang laundry"},{"id":"cocinar","icon":"🍳","pts":5,"stat":"hogar","es":"Cocinar","fr":"Cuisiner","en":"Cook"},{"id":"platos","icon":"🍽️","pts":3,"stat":"hogar","es":"Platos","fr":"Vaisselle","en":"Dishes"},{"id":"basura","icon":"🗑️","pts":2,"stat":"hogar","es":"Sacar basura","fr":"Sortir la poubelle","en":"Take out trash"},{"id":"compra","icon":"🛒","pts":4,"stat":"hogar","es":"Ir de compra","fr":"Faire les courses","en":"Groceries"},{"id":"bano","icon":"🚿","pts":5,"stat":"hogar","es":"Limpiar baño","fr":"Nettoyer la salle de bain","en":"Clean bathroom"},{"id":"ejercicio","icon":"🏋️","pts":5,"stat":"vitalidad","es":"Ejercicio","fr":"Sport","en":"Workout"},{"id":"dientes","icon":"🪥","pts":1,"stat":"vitalidad","es":"Lavarse dientes","fr":"Se brosser les dents","en":"Brush teeth"},{"id":"dormir","icon":"😴","pts":2,"stat":"vitalidad","es":"Dormir bien","fr":"Bien dormir","en":"Good sleep"},{"id":"caminar","icon":"🚶","pts":3,"stat":"vitalidad","es":"Caminar","fr":"Marcher","en":"Walk"},{"id":"leer","icon":"📖","pts":4,"stat":"mente","es":"Leer","fr":"Lire","en":"Read"},{"id":"aprender","icon":"🧠","pts":4,"stat":"mente","es":"Aprender algo","fr":"Apprendre un truc","en":"Learn something"},{"id":"jugar","icon":"🎮","pts":3,"stat":"alegria","es":"Jugar un rato","fr":"Jouer un peu","en":"Play a game"},{"id":"hobby","icon":"🎨","pts":3,"stat":"alegria","es":"Hobby","fr":"Loisir créatif","en":"Hobby"},{"id":"peli","icon":"🎬","pts":3,"stat":"alegria","es":"Ver algo juntos","fr":"Regarder un truc ensemble","en":"Watch something together"},{"id":"musica","icon":"🎧","pts":2,"stat":"alegria","es":"Escuchar música a gusto","fr":"Écouter de la musique","en":"Listen to music"},{"id":"paseojuntos","icon":"🌙","pts":5,"stat":"union","es":"Pasear juntos","fr":"Se promener ensemble","en":"Walk together"},{"id":"cenasinmovil","icon":"🕯️","pts":5,"stat":"union","es":"Cenar sin móviles","fr":"Dîner sans téléphones","en":"Dinner with no phones"},{"id":"cocinarjuntos","icon":"👩‍🍳","pts":5,"stat":"union","es":"Cocinar juntos","fr":"Cuisiner ensemble","en":"Cook together"},{"id":"hablar","icon":"💬","pts":4,"stat":"union","es":"Hablar de verdad","fr":"Se parler vraiment","en":"Really talk"},{"id":"abrazo","icon":"🫂","pts":2,"stat":"union","es":"Abrazo largo","fr":"Un long câlin","en":"Long hug"},{"id":"plan","icon":"🗺️","pts":4,"stat":"union","es":"Planear algo juntos","fr":"Prévoir un truc ensemble","en":"Plan something together"},{"id":"regar","icon":"💧","pts":3,"stat":"jardin","es":"Regar las plantas","fr":"Arroser les plantes","en":"Water the plants"},{"id":"calathea","icon":"🪴","pts":3,"stat":"jardin","es":"Cuidar una planta pachucha","fr":"Soigner une plante mal en point","en":"Nurse a struggling plant"},{"id":"balcon","icon":"🌱","pts":4,"stat":"jardin","es":"Atender el balcón","fr":"S'occuper du balcon","en":"Tend the balcony"},{"id":"cosechar","icon":"🌿","pts":4,"stat":"jardin","es":"Cosechar hierbas para cocinar","fr":"Récolter des herbes pour cuisiner","en":"Harvest herbs for cooking"},{"id":"plantanueva","icon":"🌻","pts":5,"stat":"jardin","es":"Plantar algo nuevo","fr":"Planter quelque chose de nouveau","en":"Plant something new"},{"id":"gato","icon":"🐈","pts":2,"stat":"jardin","es":"Salvar una planta del gato","fr":"Sauver une plante du chat","en":"Save a plant from the cat"}],"MOODS":[{"id":"m0","emoji":"🙂","es":"Todo bien","fr":"Ça va","en":"All good","care":false},{"id":"m1","emoji":"😤","es":"Puto trabajo","fr":"Putain de boulot","en":"Work is hell","care":true},{"id":"m2","emoji":"🥱","es":"Reventado","fr":"Crevé·e","en":"Wiped out","care":true},{"id":"m3","emoji":"🌫️","es":"Bajón","fr":"Coup de mou","en":"Low","care":true},{"id":"m4","emoji":"🌿","es":"CBD y calma","fr":"CBD et calme","en":"CBD and calm","care":false},{"id":"m5","emoji":"🔋","es":"Con energía","fr":"Plein·e d'énergie","en":"Full of energy","care":false},{"id":"m6","emoji":"🫠","es":"Necesito mimos","fr":"Besoin de câlins","en":"Need cuddles","care":true},{"id":"m7","emoji":"🎉","es":"De buen rollo","fr":"De bonne humeur","en":"In a great mood","care":false},{"id":"m8","emoji":"😈","es":"Con ganas de travesuras","fr":"D'humeur espiègle","en":"Feeling mischievous","care":false},{"id":"m9","emoji":"✈️","es":"¿Vamos a Singapur?","fr":"On va à Singapour ?","en":"Shall we go to Singapore?","care":false,"replies":"singapur"}],"CARE":[{"id":"c1","emoji":"💪","es":"Fuerza amor, eres la mejor.","fr":"Courage mon amour, t'es la meilleure.","en":"Hang in there love, you're the best."},{"id":"c2","emoji":"🫂","es":"Ven que te abrazo.","fr":"Viens là que je te serre fort.","en":"Come here, let me hold you."},{"id":"c3","emoji":"🍽️","es":"Hoy no cocinas tú. Orden real.","fr":"Ce soir tu ne cuisines pas. Ordre royal.","en":"You're not cooking tonight. Royal order."},{"id":"c4","emoji":"📜","es":"Decreto: hoy no se te exige nada.","fr":"Décret : aujourd'hui on ne te demande rien.","en":"Decree: nothing is asked of you today."},{"id":"c5","emoji":"👑","es":"El reino aguanta, tú descansa.","fr":"Le royaume tient bon, repose-toi.","en":"The realm holds. You rest."},{"id":"c6","emoji":"⚔️","es":"Dime quién ha sido y mando la caballería.","fr":"Dis-moi qui c'est et j'envoie la cavalerie.","en":"Tell me who it was and I'll send the cavalry."},{"id":"c7","emoji":"🛌","es":"Hoy abdicamos los dos.","fr":"Aujourd'hui on abdique tous les deux.","en":"Today we both abdicate."}],"HYPE":[{"id":"h1","emoji":"📯","es":"Los bardos cantarán esta colada.","fr":"Les bardes chanteront cette lessive.","en":"The bards will sing of this laundry."},{"id":"h2","emoji":"👑","es":"La corona te queda bien hoy.","fr":"La couronne te va bien aujourd'hui.","en":"The crown suits you today."},{"id":"h3","emoji":"🫡","es":"Su Majestad se ha lucido.","fr":"Sa Majesté s'est surpassée.","en":"Your Majesty has outdone yourself."},{"id":"h4","emoji":"😭","es":"El pueblo llora de gratitud. El pueblo soy yo.","fr":"Le peuple pleure de gratitude. Le peuple, c'est moi.","en":"The people weep with gratitude. The people is me."},{"id":"h5","emoji":"📜","es":"Esto entra en los libros de historia.","fr":"Ça entre dans les livres d'histoire.","en":"This goes in the history books."},{"id":"h6","emoji":"🤨","es":"El consejo real está perplejo. Nadie lo esperaba.","fr":"Le conseil royal est perplexe. Personne ne s'y attendait.","en":"The royal council is baffled. Nobody saw this coming."},{"id":"h7","emoji":"🏛️","es":"Se erigirá una estatua. Pequeña, pero se erigirá.","fr":"On érigera une statue. Petite, mais on l'érigera.","en":"A statue shall be raised. A small one, but raised."},{"id":"h8","emoji":"🔔","es":"Que suenen las campanas del reino.","fr":"Que sonnent les cloches du royaume.","en":"Let the bells of the realm ring."},{"id":"h9","emoji":"😏","es":"La corte aprueba. La corte también quiere premio.","fr":"La cour approuve. La cour veut aussi sa récompense.","en":"The court approves. The court also wants a reward."}],"LETTERS":[{"id":"l1","es":"Te amo.","fr":"Je t'aime.","en":"I love you."},{"id":"l2","es":"Gracias por todo lo que haces.","fr":"Merci pour tout ce que tu fais.","en":"Thank you for everything you do."},{"id":"l3","es":"Qué suerte tengo contigo.","fr":"J'ai tellement de chance avec toi.","en":"I'm so lucky to have you."},{"id":"l4","es":"Pienso en ti ahora mismo.","fr":"Je pense à toi là, maintenant.","en":"I'm thinking of you right now."},{"id":"l5","es":"Contigo la casa es hogar.","fr":"Avec toi, la maison devient un foyer.","en":"With you, the house is a home."}]};
type Lang = "es" | "fr" | "en";

const APP_STR: Record<Lang, { notifSub: string; newDeed: string; newBoard: string; boardDone: string; moodChanged: string }> = {
  es: { notifSub: "Kingdom of Saint-Dié", newDeed: "nueva hazaña", newBoard: "nuevo encargo en el tablón", boardDone: "encargo resuelto", moodChanged: "ahora está" },
  fr: { notifSub: "Kingdom of Saint-Dié", newDeed: "nouvel exploit", newBoard: "nouvelle requête au tableau", boardDone: "requête réglée", moodChanged: "est maintenant" },
  en: { notifSub: "Kingdom of Saint-Dié", newDeed: "new deed", newBoard: "new board request", boardDone: "request cleared", moodChanged: "is now" },
};

function findById(list: any[], id: string) { return list.find((x) => x.id === id); }

async function otherProfile(actorId: string) {
  const { data } = await sb.from("profiles").select("*").neq("id", actorId);
  return data && data[0];
}

async function sendToUser(userId: string, title: string, body: string, tag: string) {
  const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || !subs.length) return;
  await Promise.all(subs.map(async (s: any) => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } };
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, tag, url: "." }));
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        // la suscripción ya no existe (se desinstaló, expiró): la limpiamos
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push error", e);
      }
    }
  }));
}

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

Deno.serve(async (req) => {
  try {
    // Sin esto, cualquiera que encuentre la URL de la función podría
    // dispararla. El Database Webhook de Supabase manda esta cabecera
    // porque tú la configuras así (ver instrucciones de despliegue).
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    const payload = await req.json();
    const table = payload.table as string;
    const type = payload.type as string; // INSERT | UPDATE
    const row = payload.record;

    let actorId: string | null = null;
    let title = "";
    let body = "";
    let tag = table;

    if (table === "deeds" && type === "INSERT") {
      actorId = row.user_id;
      const other = await otherProfile(actorId);
      if (!other) return new Response("ok");
      const lang: Lang = (other.lang || "es") as Lang;
      const task = CAT.TASKS.find((x: any) => x.id === row.task_id);
      const statName = CAT.STATS[row.stat]?.[lang] || row.stat;
      title = (task ? task.icon + " " : "") + APP_STR[lang].newDeed;
      body = (task ? task[lang] : row.task_id) + "  +" + row.points + " " + statName;
      await sendToUser(other.id, title, body, tag);
    }

    if (table === "board" && type === "INSERT") {
      actorId = row.created_by;
      const other = await otherProfile(actorId);
      if (!other) return new Response("ok");
      const lang: Lang = (other.lang || "es") as Lang;
      title = "📋 " + APP_STR[lang].newBoard;
      body = row.text;
      await sendToUser(other.id, title, body, tag);
    }

    if (table === "board" && type === "UPDATE" && row.done_by && !payload.old_record?.done_by) {
      actorId = row.done_by;
      const other = await otherProfile(actorId);
      if (!other) return new Response("ok");
      const lang: Lang = (other.lang || "es") as Lang;
      title = "✅ " + APP_STR[lang].boardDone;
      body = row.text;
      tag = "board-done";
      await sendToUser(other.id, title, body, tag);
    }

    if (table === "messages" && type === "INSERT") {
      actorId = row.from_user;
      const other = await otherProfile(actorId);
      if (!other) return new Response("ok");
      const lang: Lang = (other.lang || "es") as Lang;
      const catalog = row.kind === "care" ? CAT.CARE : row.kind === "hype" ? CAT.HYPE : row.kind === "letter" ? CAT.LETTERS : null;
      const msg = catalog ? findById(catalog, row.payload_id) : null;
      title = (msg?.emoji ? msg.emoji + " " : "💌 ");
      body = msg ? msg[lang] : row.payload_id;
      tag = "message";
      await sendToUser(other.id, title, body, tag);
    }

    if (table === "profiles" && type === "UPDATE") {
      const old = payload.old_record;
      if (old && old.mood_id !== row.mood_id) {
        actorId = row.id;
        const other = await otherProfile(actorId);
        if (!other) return new Response("ok");
        const lang: Lang = (other.lang || "es") as Lang;
        const mood = CAT.MOODS.find((x: any) => x.id === row.mood_id);
        const actorProf = await sb.from("profiles").select("name").eq("id", actorId).single();
        const actorName = actorProf.data?.name || "";
        title = (mood?.emoji ? mood.emoji + " " : "") + actorName;
        body = APP_STR[lang].moodChanged + ": " + (mood ? mood[lang] : row.mood_id);
        tag = "mood";
        await sendToUser(other.id, title, body, tag);
      }
    }

    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
