import {openedRoots,readMessage} from './shared.js';
// Candidate Gmail DOM adapter. Keep all provider selectors here; real-layout acceptance is separate.
export const gmailSelectors={roots:'.adn, .gs:has(.a3s):not(.adn .gs)',body:'.a3s',sender:['.gD[email]'],name:['.gD'],subject:['h2.hP'],replyTo:['[data-field="reply-to"]'],headerRows:'.ajA tr',attachments:'.aQH .aV3'};
export const gmailAdapter={id:'gmail',hosts:['mail.google.com'],roots:doc=>openedRoots(doc,gmailSelectors),read:root=>readMessage(root,'gmail',gmailSelectors)};
