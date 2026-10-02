export function launchUrlFromLog(log, origin) {
 const base=new URL(origin);
 if(base.protocol!=='http:' || base.hostname!=='127.0.0.1' || base.username || base.password || base.pathname!=='/' || base.search || base.hash)throw Error('QUALIFICATION_ORIGIN_INVALID');
 return [...log.matchAll(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/gu)].map(match=>match[0]).find(value=>new URL(value).origin===base.origin);
}
