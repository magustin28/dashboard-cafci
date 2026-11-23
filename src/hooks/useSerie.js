import { useEffect, useState } from "react";
import { API_BASE } from "../lib/utils";

// Trae la serie histórica de un fondo desde GET /api/serie/:cafci.
// Devuelve { serie, loading, error }. Si cambia el cafci, aborta el fetch anterior.
// La serie llega como { cafci, fondo, moneda, puntos: [{ fecha, valor }], desde, hasta }.
export function useSerie(cafci) {
  const [serie, setSerie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cafci) return;

    const controller = new AbortController();
    let cancelado = false;

    // El reset va en una microtask: la regla react-hooks/set-state-in-effect no permite
    // setState síncrono en el cuerpo del effect (dispara renders en cascada).
    queueMicrotask(() => {
      if (cancelado) return;
      setLoading(true);
      setError(null);
      setSerie(null);
    });

    fetch(`${API_BASE}/api/serie/${cafci}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelado) return;
        setSerie(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado || err.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [cafci]);

  return { serie, loading, error };
}
