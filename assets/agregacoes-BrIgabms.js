import{c as s}from"./index-BFutAe2C.js";import{e as c}from"./ResultadoConsulta-CC8o6ifO.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=s("Shell",[["path",{d:"M14 11a2 2 0 1 1-4 0 4 4 0 0 1 8 0 6 6 0 0 1-12 0 8 8 0 0 1 16 0 10 10 0 1 1-20 0 11.93 11.93 0 0 1 2.42-7.22 2 2 0 1 1 3.16 2.44",key:"1cn552"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=s("Zap",[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]]);function u(n){var r,i;const e=new Map;for(const a of n){const t=c(a.player_id),o=e.get(t)??{playerId:a.player_id,nome:((r=a.nome)==null?void 0:r.trim())||`#${t}`,vitorias:0};o.vitorias+=a.vitorias??0,(i=a.nome)!=null&&i.trim()&&(o.nome=a.nome.trim()),e.set(t,o)}return[...e.values()]}function f(n){var r,i;const e=new Map;for(const a of n){const t=c(a.player_id),o=e.get(t)??{playerId:a.player_id,nome:((r=a.nome)==null?void 0:r.trim())||`#${t}`,total:0,aquisicoes:0};o.total+=a.total??0,o.aquisicoes+=a.aquisicoes??0,(i=a.nome)!=null&&i.trim()&&(o.nome=a.nome.trim()),e.set(t,o)}return[...e.values()]}export{p as S,d as Z,u as a,f as b};
