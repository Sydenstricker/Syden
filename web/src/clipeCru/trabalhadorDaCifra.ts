// O worker de cifra do LiveKit com o gancho do clipe sem recodificar na frente (ver ganchoDaCifra.ts). A ORDEM DOS
// IMPORTS IMPORTA: o gancho precisa instalar os acessores de onmessage e onrtctransform antes de o LiveKit atribuí-los.
import './ganchoDaCifra';
import 'livekit-client/e2ee-worker';
