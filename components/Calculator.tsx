'use client';

import React, { useState, useEffect, useRef } from 'react';
import AuthModal from './AuthModal';
import CardManager from './CardManager';

interface Category {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  title: string;
  rawText: string;
  rewardAmount: number;
  calculatedReward: number;
  rewardType: string;
  isPercentage: boolean;
  minAmount: number;
  maxAmount: number | null;
  isNewCustomerOnly: boolean;
  requiresEnrollment: boolean;
  isOwnedByUser: boolean;
  isFreePrivilege?: boolean;
  paymentMethodTip?: string | null;
  bank: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
  };
  warningTags: {
    newCustomerWarning: string | null;
    enrollmentWarning: string | null;
  };
}

interface CalculationResponse {
  success: boolean;
  amount: number;
  categoryId: string;
  resultCount: number;
  bestOffer: Campaign | null;
  campaigns: Campaign[];
  isLoggedIn: boolean;
  ownedBankIds: string[];
  error?: string;
}

interface CalculatorProps {
  categories: Category[];
  initialUser: { username: string; cards: string[] } | null;
  campaignCount: number;
  bankCount: number;
}

export default function Calculator({ categories, initialUser, campaignCount, bankCount }: CalculatorProps) {
  const [user, setUser] = useState<{ username: string; cards: string[] } | null>(initialUser);
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [queryText, setQueryText] = useState<string>('');
  const [rewardTypes, setRewardTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CalculationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtre ve sıralama durumları
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('match');
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [excludeEnrollment, setExcludeEnrollment] = useState<boolean>(false);
  const [excludeNewCustomer, setExcludeNewCustomer] = useState<boolean>(false);

  const [showFreePrivileges, setShowFreePrivileges] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showCardManager, setShowCardManager] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'owned' | 'opportunities'>('owned');
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setResponse(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);
    setExpandedId(null);
    setSelectedBanks([]);
    setVisibleCount(20);
    setExcludeEnrollment(false);
    setExcludeNewCustomer(false);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Lütfen geçerli bir harcama tutarı girin.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parsedAmount,
          categoryId: categoryId || undefined,
          queryText: queryText || undefined,
          rewardTypes: rewardTypes.length > 0 ? rewardTypes : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Hesaplama yapılırken bir hata oluştu.');
      }

      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'API ile bağlantı kurulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      {/* Header Alanı */}
      <header>
        <div className="logo" style={{ cursor: 'pointer' }}>
          Echonomich
          <span className="logo-badge">
            {user ? 'Kişiselleştirilmiş' : 'Çoklu Banka Destekli'}
          </span>
        </div>
        <div className="auth-buttons-container" ref={dropdownRef}>
          {user ? (
            <div className="user-menu-container">
              <button 
                type="button"
                className="user-menu-trigger"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                title="Kullanıcı Menüsü"
                aria-label="Kullanıcı Menüsü"
              >
                <span className="user-avatar-initials">
                  {user.username.split('@')[0].substring(0, 2).toUpperCase()}
                </span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="user-avatar-icon"
                >
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </button>

              {showUserDropdown && (
                <div className="user-dropdown-menu glass-card">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-welcome">👋 Hoş geldin,</div>
                    <div className="user-dropdown-email" title={user.username}>{user.username}</div>
                  </div>
                  <div className="dropdown-divider" />
                  <button 
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowCardManager(true);
                      setShowUserDropdown(false);
                    }}
                  >
                    💳 Kartlarım ({user.cards.length})
                  </button>
                  <button 
                    type="button"
                    className="dropdown-item logout"
                    onClick={() => {
                      handleLogout();
                      setShowUserDropdown(false);
                    }}
                  >
                    🚪 Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              type="button"
              className="btn-auth-header primary"
              onClick={() => setShowAuthModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                style={{ width: '16px', height: '16px' }}
              >
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
              <span>Giriş Yap / Kayıt Ol</span>
            </button>
          )}
        </div>
      </header>

      {/* Tanıtım Alanı */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
          Harcamadan Önce En Çok Kazandıran Kartı Seçin
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
          {user ? (
            <>
              Cüzdanınızdaki <strong>{user.cards.length} kart</strong> ve sistemdeki diğer kartlar için <strong>{campaignCount} aktif kampanya</strong> taranıyor.
            </>
          ) : (
            <>
              Platformdaki <strong>{bankCount} bankaya</strong> ait <strong>{campaignCount} güncel kampanya</strong> şartını tarayın, harcama limitlerinize göre anlık en yüksek kazancı bulun.
            </>
          )}
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Sol Panel: Giriş Formu */}
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.25rem' }}>Harcama Bilgileri</h2>
          
          <form onSubmit={handleCalculate}>
            <div className="form-group">
              <label htmlFor="amount">Harcama Tutarı (TL)</label>
              <input
                type="number"
                id="amount"
                className="form-control"
                placeholder="Örn: 2500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0"
                step="any"
              />
            </div>

            <div className="form-group">
              <label htmlFor="queryText">Harcama Yeri / Marka (İsteğe Bağlı)</label>
              <input
                type="text"
                id="queryText"
                className="form-control"
                placeholder="Örn: Migros, Opet, İstikbal, Daikin..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.35rem', display: 'block' }}>
                İstikbal, Migros, Şok veya Opet gibi marka girerek tam eşleşme arayabilirsiniz.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="category">Harcama Sektörü / Kategorisi</label>
              <select
                id="category"
                className="form-control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Tüm Kategoriler (Otomatik Algıla)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                İstenen Ödül Türü (İsteğe Bağlı)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  { val: 'POINT', label: 'Bankkart Lira / Puan' },
                  { val: 'DISCOUNT', label: 'İndirim' },
                  { val: 'CASHBACK', label: 'Nakit İade' },
                  { val: 'INSTALLMENT', label: 'Taksit' },
                ].map((item) => {
                  const isActive = rewardTypes.includes(item.val);
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setRewardTypes(rewardTypes.filter((t) => t !== item.val));
                        } else {
                          setRewardTypes([...rewardTypes, item.val]);
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                        background: isActive ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        color: isActive ? '#f43f5e' : 'var(--muted-foreground)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Hesaplanıyor...' : 'En Kârlı Kartı Bul'}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>

        {/* Sağ Panel: Kampanya Önerileri */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
          <h2 style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.25rem' }}>Uyumlu Kredi Kartı Kampanyaları</h2>

          {loading && (
            <div className="empty-state">
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Hesaplama Yapılıyor...</div>
              <p>Veritabanındaki kampanyalar taranıyor ve analiz ediliyor.</p>
            </div>
          )}

          {!loading && !response && (
            <div className="empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 500 }}>Hesaplama Motoru Hazır</div>
              <p>Harcama tutarı ve kategori seçerek en kârlı kredi kartı kampanya önerisini anında görüntüleyin.</p>
            </div>
          )}

          {!loading && response && response.campaigns.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 500 }}>Uyumlu Kampanya Bulunamadı</div>
              <p>Bu harcama tutarı veya kategori için aktif bir kampanya koşulu bulunmuyor.</p>
            </div>
          )}

          {!loading && response && response.campaigns.length > 0 && (() => {
            // Kampanyaları sekmeye göre ayır
            const ownedCampaigns = response.campaigns.filter((c) => c.isOwnedByUser);
            const opportunityCampaigns = response.campaigns.filter((c) => !c.isOwnedByUser);

            // Cüzdanınızdaki en kârlı teklifin getirisini hesaplayalım (karşılaştırma için)
            const maxOwnedReward = ownedCampaigns.reduce(
              (max, c) => (c.calculatedReward > max ? c.calculatedReward : max),
              0
            );

            // Aktif liste
            const activeList = user
              ? activeTab === 'owned'
                ? ownedCampaigns
                : opportunityCampaigns
              : response.campaigns;

            const cashbackCampaigns = activeList.filter((c) => !c.isFreePrivilege);

            // Dinamik banka kampanya sayıları
            const bankCounts = cashbackCampaigns.reduce((acc: Record<string, number>, camp) => {
              acc[camp.bank.name] = (acc[camp.bank.name] || 0) + 1;
              return acc;
            }, {});

            // Kampanyaları filtrele
            const filtered = cashbackCampaigns.filter((camp) => {
              if (selectedBanks.length > 0 && !selectedBanks.includes(camp.bank.name)) {
                return false;
              }
              if (excludeEnrollment && camp.requiresEnrollment) {
                return false;
              }
              if (excludeNewCustomer && camp.isNewCustomerOnly) {
                return false;
              }
              return true;
            });

            // Kampanyaları sırala
            const sorted = [...filtered].sort((a, b) => {
              if (sortBy === 'reward') {
                return b.calculatedReward - a.calculatedReward;
              }
              if (sortBy === 'minAmount') {
                return a.minAmount - b.minAmount;
              }
              return (b as any).matchScore - (a as any).matchScore || b.calculatedReward - a.calculatedReward;
            });

            const paginated = sorted.slice(0, visibleCount);

            const getBankClass = (bankName: string) => {
              if (bankName.includes('Ziraat')) return 'ziraat';
              if (bankName.includes('Axess')) return 'axess';
              if (bankName.includes('Bonus')) return 'bonus';
              if (bankName.includes('World')) return 'world';
              if (bankName.includes('Maximum')) return 'maximum';
              return '';
            };

            return (
              <div style={{ flex: 1 }}>
                {/* Giriş yapmış kullanıcı için Sekme Kontrolleri */}
                {user && (
                  <div className="campaign-tabs">
                    <button
                      type="button"
                      className={`campaign-tab-btn ${activeTab === 'owned' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('owned');
                        setVisibleCount(20);
                      }}
                    >
                      💳 Kartlarımın Kampanyaları ({ownedCampaigns.length})
                    </button>
                    <button
                      type="button"
                      className={`campaign-tab-btn ${activeTab === 'opportunities' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('opportunities');
                        setVisibleCount(20);
                      }}
                    >
                      🌟 Kaçırdığınız Fırsatlar ({opportunityCampaigns.length})
                    </button>
                  </div>
                )}

                {/* Boş Durum: Kart seçilmediyse veya uyumlu kampanya yoksa */}
                {user && activeTab === 'owned' && user.cards.length === 0 && (
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>💳</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>
                      Henüz Kart Seçmediniz
                    </div>
                    <p style={{ marginBottom: '1.5rem', maxWidth: '380px', margin: '0 auto 1.5rem auto' }}>
                      Cüzdanınızdaki kartlara göre özel filtreleme yapabilmemiz için sahip olduğunuz kartları tanımlayın.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ maxWidth: '220px', margin: '0 auto' }}
                      onClick={() => setShowCardManager(true)}
                    >
                      Sahip Olduğum Kartları Seç
                    </button>
                  </div>
                )}

                {user && activeTab === 'owned' && user.cards.length > 0 && ownedCampaigns.length === 0 && (
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💡</div>
                    <p style={{ maxWidth: '400px', margin: '0 auto' }}>
                      Mevcut kartlarınıza ait bu harcamayla uyumlu aktif kampanya bulunamadı. Fırsatları incelemek için **"Kaçırdığınız Fırsatlar"** sekmesine göz atabilirsiniz.
                    </p>
                  </div>
                )}

                 {/* Kampanya Listesi Gösterimi */}
                 {!(user && activeTab === 'owned' && user.cards.length === 0) && (
                   <>
                    {/* Ücretsiz Ayrıcalıklar & Sürekli Fırsatlar Paneli */}
                    {(() => {
                      const freePrivileges = activeList.filter(c => c.isFreePrivilege);
                      if (freePrivileges.length === 0) return null;

                      return (
                        <div className="glass-card" style={{
                          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          marginBottom: '1.5rem',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowFreePrivileges(!showFreePrivileges)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <span style={{ fontSize: '1.4rem' }}>🎁</span>
                              <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                  {user 
                                    ? activeTab === 'owned'
                                      ? 'Kartlarınızın Ücretsiz Ayrıcalıkları & Sürekli Fırsatları'
                                      : 'Fırsat Kartlarının Ücretsiz Ayrıcalıkları'
                                    : 'Kartların Ücretsiz Ayrıcalıkları & Sürekli Fırsatları'}
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.15rem' }}>
                                  Harcama limiti gerektirmeyen, sürekli yararlanabileceğiniz {freePrivileges.length} teklif bulundu.
                                </p>
                              </div>
                            </div>
                            <span style={{ color: '#f43f5e', fontSize: '0.85rem', fontWeight: 600 }}>
                              {showFreePrivileges ? 'Gizle ▲' : 'Göster ▼'}
                            </span>
                          </div>

                          {showFreePrivileges && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {freePrivileges.map((camp) => {
                                const isExpanded = expandedId === camp.id;
                                const bankClass = getBankClass(camp.bank.name);
                                return (
                                  <div 
                                    key={camp.id} 
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(camp.id); }}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.02)',
                                      border: '1px solid rgba(255, 255, 255, 0.05)',
                                      borderRadius: '8px',
                                      padding: '0.85rem 1rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>{camp.title}</h4>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                          <span className={`tag tag-bank ${bankClass}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>{camp.bank.name}</span>
                                          <span className="tag tag-category" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>{camp.category.name}</span>
                                          {camp.paymentMethodTip && (
                                            <span style={{
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              color: '#10b981',
                                              background: 'rgba(16, 185, 129, 0.05)',
                                              padding: '0.15rem 0.4rem',
                                              borderRadius: '4px',
                                              border: '1px solid rgba(16, 185, 129, 0.1)',
                                            }}>
                                              {camp.paymentMethodTip}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 600 }}>
                                        {isExpanded ? 'Detayları Gizle ▲' : 'Detayları Göster ▼'}
                                      </span>
                                    </div>

                                    {isExpanded && (() => {
                                      const allLines = camp.rawText.split('\n').map((line) => line.trim());
                                      const validityLine = allLines.find((line) => line.startsWith('Geçerlilik Tarihi:'));
                                      const validityDate = validityLine ? validityLine.replace('Geçerlilik Tarihi:', '').trim() : null;

                                      const conditionLines = allLines.filter((line) => {
                                        if (!line) return false;
                                        if (line.startsWith('Başlık:')) return false;
                                        if (line.startsWith('Özet:')) return false;
                                        if (line.startsWith('Sektör:')) return false;
                                        if (line.startsWith('Geçerlilik Tarihi:')) return false;
                                        if (line.startsWith('Koşullar:')) return false;
                                        return true;
                                      });

                                      return (
                                        <div 
                                          style={{
                                            marginTop: '0.75rem',
                                            paddingTop: '0.75rem',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                            fontSize: '0.8rem',
                                            color: '#a1a1aa',
                                            lineHeight: '1.4',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {validityDate && (
                                            <div style={{ marginBottom: '0.5rem', color: '#f43f5e', fontWeight: 500 }}>
                                              📅 Geçerlilik: {validityDate}
                                            </div>
                                          )}
                                          <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                                            {conditionLines.slice(0, 8).map((line, lIdx) => (
                                              <li key={lIdx} style={{ marginBottom: '0.25rem' }}>{line}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Filtre ve Sıralama Çubuğu */}
                    <div className="filter-bar">
                      <div className="filter-section">
                        <span className="filter-label">Bankaya Göre Filtrele</span>
                        <div className="bank-pills">
                          {Object.entries(bankCounts).map(([bankName, count]) => {
                            const bankClass = getBankClass(bankName);
                            const isActive = selectedBanks.includes(bankName);
                            const activeClass = isActive ? `active-${bankClass}` : '';
                            return (
                              <button
                                key={bankName}
                                type="button"
                                className={`bank-pill ${activeClass}`}
                                onClick={() => {
                                  if (isActive) {
                                    setSelectedBanks(selectedBanks.filter((b) => b !== bankName));
                                  } else {
                                    setSelectedBanks([...selectedBanks, bankName]);
                                  }
                                  setVisibleCount(20);
                                }}
                              >
                                <span>{bankName}</span>
                                <span className="bank-count">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="filter-row-bottom">
                        <div className="toggles-group">
                          <label className="toggle-item">
                            <div className="switch">
                              <input
                                type="checkbox"
                                checked={excludeEnrollment}
                                onChange={(e) => {
                                  setExcludeEnrollment(e.target.checked);
                                  setVisibleCount(20);
                                }}
                              />
                              <span className="slider"></span>
                            </div>
                            <span>Katılım Gerekmesin</span>
                          </label>

                          <label className="toggle-item">
                            <div className="switch">
                              <input
                                type="checkbox"
                                checked={excludeNewCustomer}
                                onChange={(e) => {
                                  setExcludeNewCustomer(e.target.checked);
                                  setVisibleCount(20);
                                }}
                              />
                              <span className="slider"></span>
                            </div>
                            <span>Herkese Açık (Yeni Üyelik Şartı Olmayan)</span>
                          </label>
                        </div>

                        <div>
                          <select
                            className="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                          >
                            <option value="match">En Alakalı Teklifler</option>
                            <option value="reward">En Yüksek Kazanç</option>
                            <option value="minAmount">En Düşük Limit</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                      Toplam <strong>{activeList.length}</strong> tekliften <strong>{filtered.length}</strong> tanesi filtrelere uyuyor. Gösterilen: <strong>{Math.min(paginated.length, filtered.length)}</strong>.
                    </p>

                    {filtered.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem' }}>
                        <p>Seçilen filtrelere uygun kampanya bulunamadı.</p>
                      </div>
                    ) : (
                      <div className="campaign-list">
                        {paginated.map((camp, idx) => {
                          const isBest = idx === 0 && sortBy === 'reward';
                          const isExpanded = expandedId === camp.id;
                          return (
                            <div
                              key={camp.id}
                              className={`campaign-item ${isBest ? 'best-offer' : ''} ${!camp.isOwnedByUser && user ? 'opportunity-card' : ''}`}
                              onClick={() => toggleExpand(camp.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              {isBest && <span className="best-badge">EN KÂRLI TEKLİF</span>}
                              {!camp.isOwnedByUser && user && <span className="opportunity-badge">FIRSAT KARTI</span>}

                              <div className="campaign-header">
                                <div>
                                  <h3 className="campaign-title">{camp.title}</h3>
                                  <p style={{ fontSize: '0.85rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
                                    Min. Harcama: {camp.minAmount.toLocaleString('tr-TR')} TL
                                  </p>
                                  {camp.paymentMethodTip && (
                                    <div style={{
                                      marginTop: '0.5rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      color: '#10b981',
                                      background: 'rgba(16, 185, 129, 0.08)',
                                      border: '1px solid rgba(16, 185, 129, 0.15)',
                                      padding: '0.25rem 0.6rem',
                                      borderRadius: '6px',
                                    }}>
                                      {camp.paymentMethodTip}
                                    </div>
                                  )}
                                </div>
                                <div className="campaign-reward">
                                  {camp.rewardType === 'INSTALLMENT' ? (
                                    <>
                                      <div className="reward-val" style={{ color: '#60a5fa' }}>
                                        {(() => {
                                          const match = camp.title.match(/(\+?\d+)\s*Taksit/i);
                                          return match ? match[1] : 'Taksit';
                                        })()}
                                      </div>
                                      <div className="reward-lbl">Taksit</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="reward-val">
                                        +{camp.calculatedReward.toLocaleString('tr-TR')} TL
                                      </div>
                                      <div className="reward-lbl">
                                        {camp.rewardType === 'POINT' && 'Puan / Lira'}
                                        {camp.rewardType === 'CASHBACK' && 'Nakit İade'}
                                        {camp.rewardType === 'DISCOUNT' && (camp.isPercentage ? `%${camp.rewardAmount} İndirim` : 'İndirim')}
                                        {!['POINT', 'CASHBACK', 'DISCOUNT', 'INSTALLMENT'].includes(camp.rewardType) && camp.rewardType}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Karşılaştırmalı Fırsat Göstergesi */}
                              {!camp.isOwnedByUser && user && (
                                <div style={{
                                  marginTop: '0.75rem',
                                  padding: '0.65rem 0.85rem',
                                  background: 'rgba(59, 130, 246, 0.08)',
                                  border: '1px solid rgba(59, 130, 246, 0.2)',
                                  borderRadius: '8px',
                                  fontSize: '0.85rem',
                                  color: '#93c5fd',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span>💡</span>
                                  <span>
                                    {camp.calculatedReward > maxOwnedReward ? (
                                      <>
                                        Bu karta sahip olsaydınız, mevcut kartlarınıza kıyasla <strong>+{Number((camp.calculatedReward - maxOwnedReward).toFixed(2))} TL</strong> daha fazla kazanabilirdiniz!
                                      </>
                                    ) : (
                                      <>
                                        Bu kartla <strong>{camp.calculatedReward} TL</strong> kazanç sağlayabilirdiniz.
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}

                              <div className="campaign-meta">
                                <span className="tag tag-bank">{camp.bank.name}</span>
                                <span className="tag tag-category">{camp.category.name}</span>
                                {camp.warningTags.newCustomerWarning && (
                                  <span className="tag tag-warning">{camp.warningTags.newCustomerWarning}</span>
                                )}
                                {camp.warningTags.enrollmentWarning && (
                                  <span className="tag tag-warning">{camp.warningTags.enrollmentWarning}</span>
                                )}
                                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#f43f5e', fontWeight: 600 }}>
                                  {isExpanded ? 'Detayları Gizle ▲' : 'Detayları Göster ▼'}
                                </span>
                              </div>

                              {isExpanded && (() => {
                                const allLines = camp.rawText.split('\n').map((line) => line.trim());
                                const validityLine = allLines.find((line) => line.startsWith('Geçerlilik Tarihi:'));
                                const validityDate = validityLine ? validityLine.replace('Geçerlilik Tarihi:', '').trim() : null;

                                const conditionLines = allLines.filter((line) => {
                                  if (!line) return false;
                                  if (line.startsWith('Başlık:')) return false;
                                  if (line.startsWith('Özet:')) return false;
                                  if (line.startsWith('Sektör:')) return false;
                                  if (line.startsWith('Geçerlilik Tarihi:')) return false;
                                  if (line.startsWith('Koşullar:')) return false;
                                  return true;
                                });

                                return (
                                  <div
                                    className="campaign-details-box"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {validityDate && (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: '#d4d4d8',
                                        marginBottom: '0.75rem',
                                        padding: '0.5rem 0.85rem',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '6px',
                                        border: '1px dashed rgba(255, 255, 255, 0.08)'
                                      }}>
                                        <span style={{ color: '#f43f5e' }}>📅</span>
                                        <span>Kampanya Dönemi: <strong>{validityDate}</strong></span>
                                      </div>
                                    )}

                                    {conditionLines.map((line, lineIdx) => (
                                      <div key={lineIdx} className="details-row">
                                        <span className="details-row-bullet">•</span>
                                        <span>{line}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {filtered.length > visibleCount && (
                      <div className="load-more-container">
                        <button
                          type="button"
                          className="btn-load-more"
                          onClick={() => setVisibleCount(visibleCount + 20)}
                        >
                          Daha Fazla Göster ({filtered.length - visibleCount} Kaldı)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Kimlik Doğrulama Modalı */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(username, cards) => {
            setUser({ username, cards });
            setResponse(null); // Oturum değişince sonuçları sıfırla
          }}
        />
      )}

      {/* Kart Yönetim Modalı */}
      {showCardManager && user && (
        <CardManager
          ownedCards={user.cards}
          onClose={() => setShowCardManager(false)}
          onUpdate={(updatedCards) => {
            setUser({ ...user, cards: updatedCards });
            setResponse(null); // Kartlar değişince sonuçları sıfırla
          }}
        />
      )}
    </>
  );
}
