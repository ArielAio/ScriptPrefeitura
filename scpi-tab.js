const URL_SCPI = "https://srv.sjduaspontes.sp.gov.br/scpi9/";

export function selecionarAbaScpi(abas = []) {
  return abas
    .filter((aba) => aba?.id && aba.url?.startsWith(URL_SCPI))
    .sort((a, b) => Number(b.active) - Number(a.active)
      || Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0))[0] || null;
}
