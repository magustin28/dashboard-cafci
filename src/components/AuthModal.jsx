import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { useModalClose } from "../hooks/useModalClose";

export default function AuthModal({ onClose }) {
  const { loginGoogle } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Cierre animado: `closing` pinta la clase de salida en el overlay y `requestClose` reemplaza
  // a onClose en TODOS los caminos (✕, clic en el fondo, ESC, login exitoso). Ver
  // hooks/useModalClose.js + las animaciones de salida en styles/portfolio.css.
  const { closing, requestClose } = useModalClose(onClose);

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose]);

  // Google es el único método. supabase-js redirige a Google y al volver la página se recarga,
  // así que acá no hace falta cerrar el modal ni avisar del login: se deja anotado el tab
  // destino en sessionStorage para que App.jsx abra "Mi Portfolio" cuando el usuario vuelva.
  const conGoogle = async () => {
    setLoading(true);
    setError("");
    sessionStorage.setItem("cafci_post_login_tab", "Mi Portfolio");
    const result = await loginGoogle();
    if (!result.ok) {
      sessionStorage.removeItem("cafci_post_login_tab");
      setLoading(false);
      setError(result.msg);
    }
  };

  return (
    <div
      className={`modal-overlay${closing ? " closing" : ""}`}
      style={{ display: "flex" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="modal">
        <button className="modal-close" onClick={requestClose}>
          ✕
        </button>
        <div className="modal-logo">
          <span className="logo-badge" style={{ fontSize: 12, padding: "5px 12px" }}>
            CAFCI
          </span>
        </div>
        <h2 className="modal-title">Iniciar sesión</h2>
        <p className="modal-subtitle">Entrá con tu cuenta de Google para ver y guardar tu portafolio de FCI</p>

        {error && (
          <p className="modal-error" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        <button className="modal-submit" onClick={conGoogle} disabled={loading}>
          {loading ? "Conectando con Google…" : "Continuar con Google"}
        </button>

        <p className="modal-note">
          Acceso privado. Tus favoritos y tu portafolio quedan asociados a tu cuenta de Google.
        </p>
      </div>
    </div>
  );
}
