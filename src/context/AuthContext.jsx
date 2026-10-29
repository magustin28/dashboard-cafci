import { useEffect, useState, useCallback, useRef } from 'react';
import { sb } from '../lib/supabase';
import { toast } from '../lib/utils';
import { AuthContext } from './authContextValue';

const LOCAL_FAV_KEY = 'cafci_favs_local';

function loadLocalFavs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_FAV_KEY) || '[]'); }
  catch { return []; }
}
function saveLocalFavs(arr) {
  localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(arr));
}

// Datos del usuario que muestra el header. Google manda full_name y avatar_url dentro de
// user_metadata; si el proveedor no los trae, se cae al nombre del email y a la inicial.
function userFromSession(session) {
  const meta = session.user.user_metadata || {};
  const email = session.user.email || '';
  return {
    id: session.user.id,
    email,
    nombre: meta.full_name || meta.name || email.split('@')[0] || '',
    avatar: meta.avatar_url || meta.picture || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);   // { id, email, nombre, avatar } | null
  const [portfolio, setPortfolio] = useState([]);
  const [favs, setFavs]           = useState([]);
  const [authReady, setAuthReady] = useState(false);

  // Keep refs so callbacks always have current values (avoids stale closures)
  const userRef      = useRef(null);
  const portfolioRef = useRef([]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

  // ── Load DB data ───────────────────────────────────────────────
  const loadFavsFromDB = useCallback(async (userId) => {
    const { data, error } = await sb.from('favoritos').select('fondo_nombre').eq('user_id', userId);
    if (error) {
      console.error('[cafci] no se pudieron leer los favoritos:', error);
      toast(`No se pudieron leer tus favoritos: ${error.message}`);
    }
    const dbFavs = data ? data.map(r => r.fondo_nombre) : [];
    const localFavs = loadLocalFavs();
    const toMerge = localFavs.filter(n => !dbFavs.includes(n));
    if (toMerge.length > 0) {
      const { error: errIns } = await sb.from('favoritos').insert(toMerge.map(n => ({ user_id: userId, fondo_nombre: n })));
      if (errIns) {
        console.error('[cafci] no se pudieron migrar los favoritos locales:', errIns);
        toast(`No se pudieron guardar tus favoritos locales: ${errIns.message}`);
      } else {
        saveLocalFavs([]);
      }
    }
    setFavs([...dbFavs, ...toMerge]);
  }, []);

  const loadPortfolio = useCallback(async (userId) => {
    const { data, error } = await sb.from('suscripciones')
      .select('*')
      .eq('user_id', userId)
      .order('fecha_compra', { ascending: true });
    if (error) {
      console.error('[cafci] no se pudo leer el portfolio:', error);
      toast(`No se pudo leer tu portfolio: ${error.message}`);
    }
    setPortfolio(data || []);
  }, []);

  // ── Auth state ─────────────────────────────────────────────────
  useEffect(() => {
    // El callback NO es async a propósito (ver el comentario de adentro).
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION: primer render con la sesión que ya existía. SIGNED_IN: recién logueado
      // (con Google, supabase-js vuelve de la redirección y emite SIGNED_IN) → hay que cargar los
      // datos en los DOS casos, si no el usuario queda sin favoritos ni portfolio.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        // Ojo: acá NO se traen datos de la base. Este callback corre dentro de la sección con
        // lock del cliente de Supabase: un fetch lento (o uno que falle) puede dejar ese lock
        // tomado y colgar después signOut() — que era justo lo que pasaba con "Cerrar sesión".
        // Los datos se cargan en el useEffect que observa `user` (más abajo).
        if (session) {
          const u = userFromSession(session);
          setUser(u);
          userRef.current = u;
        } else {
          setFavs(loadLocalFavs());
        }
        setAuthReady(true);
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setPortfolio([]);
        setFavs(loadLocalFavs());
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        // En un refresh el id no cambia: alcanza con mantener el ref al día. Si acá se llamara a
        // setUser con un objeto nuevo, el useEffect de carga correría de nuevo sin motivo (el
        // token se refresca cada hora) y volvería a pedirle el portfolio a la base.
        userRef.current = userFromSession(session);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadFavsFromDB, loadPortfolio]);

  // Favoritos y portfolio en cuanto hay usuario logueado. Antes esto se hacía dentro del callback
  // de onAuthStateChange (con await adentro): al sacarlo, el lock del cliente de Supabase queda
  // libre enseguida y signOut() no se cuelga.
  useEffect(() => {
    if (!user) return;
    loadFavsFromDB(user.id);
    loadPortfolio(user.id);
  }, [user, loadFavsFromDB, loadPortfolio]);

  // ── Auth actions ───────────────────────────────────────────────
  // Login con Google: el ÚNICO método habilitado (el acceso sigue siendo privado: sólo las
  // cuentas que ya existen en Supabase, o las que se den de alta a mano, pueden entrar).
  // supabase-js redirige a Google y al volver procesa los tokens del hash: acá sólo se dispara
  // la redirección, el usuario se resuelve en onAuthStateChange (evento SIGNED_IN).
  const loginGoogle = useCallback(async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: 'select_account' }, // permite elegir la cuenta (varios usuarios)
      },
    });
    if (error) return { ok: false, msg: error.message };
    return { ok: true, redirect: true };
  }, []);

  // Cerrar sesión. Dos cosas importantes:
  // 1) Se limpia el estado ANTES de hablar con Supabase. Antes se limpiaba después del await, así
  //    que si signOut() no resolvía (el cliente se queda esperando su lock del navegador) el botón
  //    parecía no hacer nada y la sesión seguía abierta.
  // 2) scope 'local' no depende de la red. Si aun así no responde en 2 s, se borra el token del
  //    storage a mano para que al recargar la app no vuelva logueado.
  const logout = useCallback(async () => {
    setUser(null);
    setPortfolio([]);
    setFavs(loadLocalFavs());

    const limpiarTokenLocal = () => {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.error('[cafci] no se pudo limpiar el token local:', e);
      }
    };

    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ timedOut: true }), 2000);
    });

    try {
      const res = await Promise.race([sb.auth.signOut({ scope: 'local' }), timeout]);
      if (res?.timedOut) {
        console.error('[cafci] signOut no respondió a tiempo: se limpia el token local a mano');
        limpiarTokenLocal();
      } else if (res?.error) {
        console.error('[cafci] no se pudo cerrar la sesión:', res.error);
        limpiarTokenLocal();
      }
    } catch (e) {
      console.error('[cafci] error al cerrar la sesión:', e);
      limpiarTokenLocal();
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  // ── Favorites ─────────────────────────────────────────────────
  const toggleFav = useCallback(async (name) => {
    if (!user) {
      const local = loadLocalFavs();
      const idx = local.indexOf(name);
      const next = idx === -1 ? [...local, name] : local.filter((_, i) => i !== idx);
      saveLocalFavs(next);
      setFavs(next);
      return;
    }
    const idx = favs.indexOf(name);
    if (idx === -1) {
      const { error } = await sb.from('favoritos').insert({ user_id: user.id, fondo_nombre: name });
      if (error) {
        console.error('[cafci] no se pudo guardar el favorito:', error);
        toast(`No se pudo guardar el favorito: ${error.message}`);
        return;
      }
      setFavs(prev => [...prev, name]);
    } else {
      const { error } = await sb.from('favoritos').delete().eq('user_id', user.id).eq('fondo_nombre', name);
      if (error) {
        console.error('[cafci] no se pudo quitar el favorito:', error);
        toast(`No se pudo quitar el favorito: ${error.message}`);
        return;
      }
      setFavs(prev => prev.filter(f => f !== name));
    }
  }, [user, favs]);

  // ── Portfolio actions ─────────────────────────────────────────
  const addSuscripcion = useCallback(async (item) => {
    const u = userRef.current;
    if (!u) return { ok: false, msg: 'No autenticado.' };
    const { data, error } = await sb.from('suscripciones').insert({
      user_id:                 u.id,
      fondo_nombre:            item.fondoNombre,
      moneda:                  item.moneda,
      fecha_compra:            item.fechaCompra,
      cantidad:                item.cantidad,
      precio_compra:           item.precioCompra,
      cuotapartes_disponibles: item.cantidad,
    }).select().single();
    if (error) return { ok: false, msg: error.message };
    setPortfolio(prev => [...prev, data]);
    return { ok: true };
  }, []);

  const deleteSuscripcion = useCallback(async (id) => {
    const u = userRef.current;
    if (!u) return { ok: false, msg: 'No autenticado.' };
    const { error } = await sb.from('suscripciones').delete().eq('id', id).eq('user_id', u.id);
    if (error) {
      console.error('[cafci] no se pudo eliminar la suscripción:', error);
      toast(`No se pudo eliminar la suscripción: ${error.message}`);
      return { ok: false, msg: error.message };
    }
    setPortfolio(prev => prev.filter(i => i.id !== id));
    return { ok: true };
  }, []);

  const addRescate = useCallback(async (item) => {
    const user = userRef.current;
    if (!user) return { ok: false, msg: 'No autenticado.' };

    const suscsFifo = portfolioRef.current
      .filter(s => s.fondo_nombre === item.fondoNombre && s.moneda === item.moneda && parseFloat(s.cuotapartes_disponibles) > 0)
      .sort((a, b) => new Date(a.fecha_compra) - new Date(b.fecha_compra));

    const totalDisp = suscsFifo.reduce((s, x) => s + parseFloat(x.cuotapartes_disponibles), 0);
    if (totalDisp < item.cuotapartesRescatadas)
      return { ok: false, msg: `Solo tenés ${totalDisp.toFixed(4)} cuotapartes disponibles.` };

    let restante = item.cuotapartesRescatadas, costoTotal = 0;
    const detalles = [];

    for (const susc of suscsFifo) {
      if (restante <= 0) break;
      const disponibles = parseFloat(susc.cuotapartes_disponibles);
      const consumidas  = Math.min(restante, disponibles);
      const costo       = Math.round(consumidas * parseFloat(susc.precio_compra) * 100) / 100;
      const venta       = Math.round(consumidas * item.precioRescate * 100) / 100;
      costoTotal += costo;
      detalles.push({
        suscripcion_id:         susc.id,
        cuotapartes_consumidas: consumidas,
        precio_compra:          parseFloat(susc.precio_compra),
        precio_rescate:         item.precioRescate,
        costo, venta,
        rendimiento:  Math.round((venta - costo) * 100) / 100,
        dias:         Math.round((new Date(item.fechaRescate) - new Date(susc.fecha_compra)) / (1000*60*60*24)),
      });
      restante -= consumidas;
    }

    costoTotal = Math.round(costoTotal * 100) / 100;
    const importeVenta = Math.round(item.cuotapartesRescatadas * item.precioRescate * 100) / 100;
    const rendimiento  = Math.round((importeVenta - costoTotal) * 100) / 100;

    const { data: rescate, error: errR } = await sb.from('rescates').insert({
      user_id:                userRef.current.id,
      fondo_nombre:           item.fondoNombre,
      moneda:                 item.moneda,
      fecha_rescate:          item.fechaRescate,
      cuotapartes_rescatadas: item.cuotapartesRescatadas,
      precio_rescate:         item.precioRescate,
      importe_venta:          importeVenta,
      costo_total:            costoTotal,
      rendimiento,
    }).select().single();
    if (errR) return { ok: false, msg: errR.message };

    const { error: errDet } = await sb.from('rescate_detalles').insert(detalles.map(d => ({ ...d, rescate_id: rescate.id, user_id: user.id })));
    if (errDet) {
      console.error('[cafci] no se pudo guardar el detalle del rescate:', errDet);
      toast(`El rescate se guardó pero falló su detalle: ${errDet.message}`);
    }

    // Update cuotapartes en suscripciones
    const updatedPortfolio = [...portfolioRef.current];
    for (const d of detalles) {
      const idx = updatedPortfolio.findIndex(s => s.id === d.suscripcion_id);
      if (idx !== -1) {
        const nuevasDisp = Math.round((parseFloat(updatedPortfolio[idx].cuotapartes_disponibles) - d.cuotapartes_consumidas) * 1e6) / 1e6;
        const { error: errUpd } = await sb.from('suscripciones').update({ cuotapartes_disponibles: nuevasDisp }).eq('id', d.suscripcion_id);
        if (errUpd) {
          console.error('[cafci] no se pudieron descontar las cuotapartes de la suscripción', d.suscripcion_id, errUpd);
          toast(`No se pudieron descontar las cuotapartes de una suscripción: ${errUpd.message}`);
        } else {
          updatedPortfolio[idx] = { ...updatedPortfolio[idx], cuotapartes_disponibles: nuevasDisp };
        }
      }
    }

    setPortfolio(updatedPortfolio);
    return { ok: true, rescate: { importeVenta, costoTotal, rendimiento } };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, portfolio, favs, authReady,
      loginGoogle, logout, toggleFav,
      addSuscripcion, deleteSuscripcion, addRescate,
      reloadPortfolio: async () => { if (user) await loadPortfolio(user.id); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}
