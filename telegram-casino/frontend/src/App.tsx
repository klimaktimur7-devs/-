import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { fetchBalance } from './api/balance';
import { fetchGifts } from './api/gifts';
import { ConsentGate } from './consent/ConsentGate';
import { TabBar, TabId } from './navigation/TabBar';
import { ComingSoonScreen } from './navigation/ComingSoonScreen';
import { Header } from './components/Header';
import { DepositModal } from './components/DepositModal';
import { ProfileScreen } from './screens/ProfileScreen';
import { MarketScreen, MarketGift } from './screens/market/MarketScreen';
import { AdminGiftsScreen } from './screens/admin/AdminGiftsScreen';
import { OverlapCirclesIcon, SunburstIcon } from './icons/Icons';

const TAB_META: Record<Exclude<TabId, 'profile' | 'shop' | 'admin'>, { title: string; icon: JSX.Element }> = {
  pvp: { title: 'PvP', icon: <OverlapCirclesIcon size={34} color="#38BDF8" /> },
  solo: { title: 'Solo', icon: <SunburstIcon size={34} color="#38BDF8" /> },
};

const SCREENS_WITH_OWN_HEADER: TabId[] = ['profile', 'shop', 'admin'];

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [balanceGram, setBalanceGram] = useState(0);
  const [gifts, setGifts] = useState<MarketGift[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('pvp');
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      fetchMe().then(setProfile).catch(() => setProfile(null));
    }
  }, [auth.status]);

  useEffect(() => {
    if (profile?.hasAcceptedConsent) {
      fetchBalance().then((response) => setBalanceGram(response.balanceGram));
    }
  }, [profile?.hasAcceptedConsent]);

  useEffect(() => {
    if (profile?.hasAcceptedConsent && activeTab === 'shop') {
      fetchGifts().then(setGifts);
    }
  }, [profile?.hasAcceptedConsent, activeTab]);

  function refreshGifts() {
    fetchGifts().then(setGifts);
  }

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !profile)) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  if (profile && !profile.hasAcceptedConsent) {
    return <ConsentGate onAccepted={() => setProfile({ ...profile, hasAcceptedConsent: true })} />;
  }

  if (!profile) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-bg text-white overflow-hidden">
      {!SCREENS_WITH_OWN_HEADER.includes(activeTab) && (
        <Header balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'profile' ? (
          <ProfileScreen
            profile={profile}
            balanceGram={balanceGram}
            onDepositClick={() => setDepositModalOpen(true)}
            onOpenShop={() => setActiveTab('shop')}
          />
        ) : activeTab === 'shop' ? (
          <MarketScreen balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} gifts={gifts} />
        ) : activeTab === 'admin' ? (
          profile.isAdmin ? <AdminGiftsScreen onGiftsChanged={refreshGifts} /> : null
        ) : (
          <ComingSoonScreen title={TAB_META[activeTab].title} icon={TAB_META[activeTab].icon} />
        )}
      </div>
      <TabBar activeTab={activeTab} onChange={setActiveTab} showAdmin={profile.isAdmin} />
      {depositModalOpen && (
        <DepositModal
          onClose={() => setDepositModalOpen(false)}
          onDeposited={() => fetchBalance().then((response) => setBalanceGram(response.balanceGram))}
        />
      )}
    </div>
  );
}
