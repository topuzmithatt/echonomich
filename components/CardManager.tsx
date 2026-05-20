import React, { useEffect, useState } from 'react';

interface Card {
  id: string;
  name: string;
}

interface Bank {
  id: string;
  name: string;
  cards: Card[];
}

interface CardManagerProps {
  ownedCards: string[];
  onUpdate: (updatedCards: string[]) => void;
  onClose: () => void;
}

export default function CardManager({ ownedCards, onUpdate, onClose }: CardManagerProps) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(ownedCards);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch('/api/banks');
        const data = await res.json();
        if (data.success) {
          setBanks(data.banks);
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        setError('Kart listesi yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    fetchBanks();
  }, []);

  const handleToggle = (cardId: string) => {
    if (selectedIds.includes(cardId)) {
      setSelectedIds(selectedIds.filter((id) => id !== cardId));
    } else {
      setSelectedIds([...selectedIds, cardId]);
    }
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/user/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds: selectedIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tercihleriniz güncellenirken bir hata oluştu.');
      }

      onUpdate(data.cards);
      setSuccessMsg('Kart cüzdanınız başarıyla güncellendi!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getBankClass = (bankName: string) => {
    if (bankName.includes('Ziraat')) return 'ziraat';
    if (bankName.includes('Axess')) return 'axess';
    if (bankName.includes('Bonus')) return 'bonus';
    if (bankName.includes('World')) return 'world';
    if (bankName.includes('Maximum')) return 'maximum';
    return '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: '1.25rem' }}>💳 Sahip Olduğunuz Kartlar</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Cüzdanınızda bulunan kredi kartlarını seçin. Kampanyalar bu seçimlerinize göre eşleştirilecektir.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>Kartlar yükleniyor...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {banks.map((bank) => {
              const bankClass = getBankClass(bank.name);
              return (
                <div key={bank.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a1a1aa', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                    {bank.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bank.cards.map((card) => {
                      const isChecked = selectedIds.includes(card.id);
                      return (
                        <label
                          key={card.id}
                          className={`card-selector-item ${isChecked ? 'selected' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            background: isChecked ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.005)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`tag tag-bank ${bankClass}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                              {card.name}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(card.id)}
                            style={{
                              width: '16px',
                              height: '16px',
                              accentColor: '#f43f5e',
                              cursor: 'pointer',
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ color: '#10b981', fontSize: '0.875rem', marginBottom: '1rem', fontWeight: 500 }}>
            {successMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            İptal
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading} style={{ minWidth: '120px' }}>
            {saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
