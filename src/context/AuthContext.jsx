import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { sb } from '../lib/supabase';

const AuthContext = createContext(null);

const LOCAL_FAV_KEY = 'cafci_favs_local';

function loadLocalFavs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_FAV_KEY) || '[]'); }
  catch { return []; }
}
function saveLocalFavs(arr) {
  localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(arr));
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);   // { id, email } | null
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
    const { data } = await sb.from('favoritos').select('fondo_nombre').eq('user_id', userId);
    const dbFavs = data ? data.map(r => r.fondo_nombre) : [];
    const localFavs = loadLocalFavs();
    const toMerge = localFavs.filter(n => !dbFavs.includes(n));
    if (toMerge.length > 0) {
      await sb.from('favoritos').insert(toMerge.map(n => ({ user_id: userId, fondo_nombre: n })));
      saveLocalFavs([]);
    }
    setFavs([...dbFavs, ...toMerge]);
  }, []);

  const loadPortfolio = useCallback(async (userId) => {
    const { data } = await sb.from('suscripciones')
      .select('*')
      .eq('user_id', userId)
      .order('fecha_compra', { ascending: true });
    setPortfolio(data || []);
  }, []);

  // ── Auth state ─────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          const u = { id: session.user.id, email: session.user.email };
          setUser(u);
          userRef.current = u;
          await Promise.all([loadFavsFromDB(u.id), loadPortfolio(u.id)]);
        } else {
          setFavs(loadLocalFavs());
        }
        setAuthReady(true);
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        const u = { id: session.user.id, email: session.user.email };
        setUser(u);
        userRef.current = u;
      }
    });
    return () => subscription.unsubscribe();
  }, [loadFavsFromDB, loadPortfolio]);

  // ── Auth actions ───────────────────────────────────────────────
  const login = useCallback(async (email, password, remember = true) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, msg: error.message };
    if (!remember) {
      // Sin persistencia: limpiar localStorage al cerrar el navegador
      sb.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    }
    const u = { id: data.user.id, email: data.user.email };
    setUser(u);
    userRef.current = u;
    await Promise.all([loadFavsFromDB(u.id), loadPortfolio(u.id)]);
    return { ok: true };
  }, [loadFavsFromDB, loadPortfolio]);

  const logout = useCallback(async () => {
    await sb.auth.signOut();
    setUser(null);
    setPortfolio([]);
    setFavs(loadLocalFavs());
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
      await sb.from('favoritos').insert({ user_id: user.id, fondo_nombre: name });
      setFavs(prev => [...prev, name]);
    } else {
      await sb.from('favoritos').delete().eq('user_id', user.id).eq('fondo_nombre', name);
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
    if (!u) return;
    await sb.from('suscripciones').delete().eq('id', id).eq('user_id', u.id);
    setPortfolio(prev => prev.filter(i => i.id !== id));
  }, []);

  const addRescate = useCallback(async (item) => {
    const user = userRef.current;
    if (!user) return { ok: false, msg: 'No autenticado.' };

    const suscsFifo = portfolioRef.current
      .filter(s => s.fondo_nombre === item.fondoNombre && parseFloat(s.cuotapartes_disponibles) > 0)
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

    await sb.from('rescate_detalle').insert(detalles.map(d => ({ ...d, rescate_id: rescate.id, user_id: user.id })));

    // Update cuotapartes en suscripciones
    const updatedPortfolio = [...portfolioRef.current];
    for (const d of detalles) {
      const idx = updatedPortfolio.findIndex(s => s.id === d.suscripcion_id);
      if (idx !== -1) {
        const nuevasDisp = Math.round((parseFloat(updatedPortfolio[idx].cuotapartes_disponibles) - d.cuotapartes_consumidas) * 1e6) / 1e6;
        await sb.from('suscripciones').update({ cuotapartes_disponibles: nuevasDisp }).eq('id', d.suscripcion_id);
        updatedPortfolio[idx] = { ...updatedPortfolio[idx], cuotapartes_disponibles: nuevasDisp };
      }
    }

    setPortfolio(updatedPortfolio);
    return { ok: true, rescate: { importeVenta, costoTotal, rendimiento } };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, portfolio, favs, authReady,
      login, logout, toggleFav,
      addSuscripcion, deleteSuscripcion, addRescate,
      reloadPortfolio: async () => { if (user) await loadPortfolio(user.id); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
