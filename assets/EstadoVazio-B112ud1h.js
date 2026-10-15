import{c as n,j as a}from"./index-BFutAe2C.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=n("Inbox",[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]]);function t({titulo:c,kicker:s,subtitulo:e,acoes:i}){return a.jsxs("header",{className:"cabecalho-pagina linha espaco-entre",children:[a.jsxs("div",{children:[s&&a.jsx("p",{className:"cabecalho-pagina__kicker",children:s}),a.jsx("h1",{className:"cabecalho-pagina__titulo",children:c}),e&&a.jsx("p",{className:"cabecalho-pagina__subtitulo",children:e})]}),i&&a.jsx("div",{className:"linha",children:i})]})}function d({titulo:c,texto:s,icone:e}){return a.jsxs("div",{className:"estado",role:"status",children:[a.jsx("div",{className:"estado__icone","aria-hidden":"true",children:e??a.jsx(l,{size:24})}),a.jsx("p",{className:"estado__titulo",children:c}),s&&a.jsx("p",{className:"estado__texto",children:s})]})}export{t as C,d as E};
