import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/dashboard-cafci/",
  // host: true → el dev server escucha en toda la red local (no sólo en localhost), así se puede
  // probar desde el celular entrando a la URL "Network" que imprime Vite:
  //   ➜  Network: http://192.168.x.x:5173/dashboard-cafci/
  // OJO: con esto el server queda accesible para cualquiera que esté en la misma red. En casa está
  // bien; en una red pública, sacar esta línea (o levantar con `vite --host` sólo cuando haga falta).
  // watch.ignored: Vite no vigila tmp/ ni dist/. Son carpetas locales de trabajo (volcados de
  // archivos, capturas, build) que ya están en .gitignore; si Vite las mira y un archivo queda
  // bloqueado mientras se escribe, el dev server se cae con EBUSY: resource busy or locked.
  server: { host: true, watch: { ignored: ["**/tmp/**", "**/dist/**"] } },
});
