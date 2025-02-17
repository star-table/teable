import { ANONYMOUS_USER_ID, type DriverClient } from '@teable/core';
import type { ShareViewGetVo } from '@teable/openapi';
import {
  AnchorContext,
  AppProvider,
  FieldProvider,
  SessionProvider,
  ViewProvider,
} from '@teable/sdk/context';
import { getWsPath } from '@teable/sdk/context/app/useConnection';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSdkLocale } from '@/features/app/hooks/useSdkLocale';
import { AppLayout } from '@/features/app/layouts';
import { addQueryParamsToWebSocketUrl } from '@/features/app/utils/socket-url';
import { ShareTablePermissionProvider } from './ShareTablePermissionProvider';
import { ShareView } from './ShareView';
import { ShareViewPageContext } from './ShareViewPageContext';
import { ViewProxy } from './ViewProxy';

export interface IShareViewPageProps {
  shareViewData: ShareViewGetVo;
  driver: DriverClient;
}

export const ShareViewPage = (props: IShareViewPageProps) => {
  const { tableId, viewId, view, fields, shareId } = props.shareViewData;
  const sdkLocale = useSdkLocale();
  const { i18n } = useTranslation();

  const { query } = useRouter();

  const wsPath = useMemo(() => {
    if (typeof window === 'object') {
      return addQueryParamsToWebSocketUrl(getWsPath(), { shareId });
    }
    return undefined;
  }, [shareId]);

  return (
    <AppProvider
      lang={i18n.language}
      wsPath={wsPath}
      locale={sdkLocale}
      forcedTheme={query.theme as string}
    >
      <ShareViewPageContext.Provider value={props.shareViewData}>
        <Head>
          <title>{view?.name ?? 'Teable'}</title>
        </Head>
        <AppLayout>
          <SessionProvider
            user={{
              id: ANONYMOUS_USER_ID,
              name: ANONYMOUS_USER_ID,
              email: '',
              notifyMeta: {},
              hasPassword: false,
              isAdmin: false,
            }}
          >
            <AnchorContext.Provider
              value={{
                tableId,
                viewId,
              }}
            >
              <ViewProvider serverData={[view]}>
                <ViewProxy serverData={[view]}>
                  <FieldProvider serverSideData={fields}>
                    <ShareTablePermissionProvider>
                      <ShareView />
                    </ShareTablePermissionProvider>
                  </FieldProvider>
                </ViewProxy>
              </ViewProvider>
            </AnchorContext.Provider>
          </SessionProvider>
        </AppLayout>
      </ShareViewPageContext.Provider>
    </AppProvider>
  );
};
