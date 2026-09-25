/** Pinned 0.1.5 root: Crystra owns the hero heading; DSH still owns the Composer. */
export function composeConversationSurface(source) {
 const signature='function ConversationRoot({ sessionId,',hero='hero && (0, react_jsx_runtime.jsx)(HeroShell, {';
 if(source.split(signature).length!==2||source.split(hero).length!==2)throw Error('CONVERSATION_SURFACE_UPSTREAM_DRIFT');
 return source.replace(signature,'function ConversationRoot({ crystraSurface = false, sessionId,').replace(hero,'hero && !crystraSurface && (0, react_jsx_runtime.jsx)(HeroShell, {');
}
