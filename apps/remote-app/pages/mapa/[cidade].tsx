import type { GetServerSideProps } from 'next';
import RemoteHomePage, { type RemoteHomeProps } from '../index';
import { getServerData } from '../../lib/getServerData';
import { parseDashboardQuery } from '../../lib/dashboardQuery';

/**
 * Rota de caminho: `/remote-app/mapa/tokyo` abre a mesma página na aba do mapa
 * com a cidade do caminho. Chega pelo shell via o rewrite `/remote-app/:path*`.
 */
export const getServerSideProps: GetServerSideProps<RemoteHomeProps> = async (context) => {
  const cidade = context.params?.cidade;
  const dashboard = parseDashboardQuery({ tab: 'map', city: typeof cidade === 'string' ? cidade : undefined });
  if (!dashboard.city) {
    return { notFound: true };
  }
  return { props: { serverData: await getServerData(), dashboard } };
};

export default RemoteHomePage;
