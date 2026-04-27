import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, Alert, ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface Show {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  show_date: string;
  ticket_url: string | null;
  description: string | null;
}

function formatShowDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function formatLocalDateInput(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTimeInput(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getHours()}`.padStart(2, '0') + ':' + `${date.getMinutes()}`.padStart(2, '0');
}

function prettySelectedDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}

function buildCalendarCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];

  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

// ─── Add / Edit Show Modal ────────────────────────────────────────────────────

interface ShowModalProps {
  visible: boolean;
  existing: Show | null;
  artistId: string;
  onClose: () => void;
  onSaved: () => void;
}

function DatePickerModal({
  visible,
  selectedDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date());

  React.useEffect(() => {
    if (visible) {
      setMonthCursor(selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date());
    }
  }, [visible, selectedDate]);

  if (!visible) return null;

  const cells = buildCalendarCells(monthCursor);
  const selectedValue = selectedDate || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={m.dateOverlay} activeOpacity={1} onPress={onClose}>
        <View style={m.dateSheet} onStartShouldSetResponder={() => true}>
          <View style={m.dateHeader}>
            <TouchableOpacity onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} activeOpacity={0.7}>
              <Text style={m.dateArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={m.dateTitle}>
              {monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} activeOpacity={0.7}>
              <Text style={m.dateArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={m.weekdayRow}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(label => (
              <Text key={label} style={m.weekdayLabel}>{label}</Text>
            ))}
          </View>

          <View style={m.calendarGrid}>
            {cells.map((day, index) => {
              if (day == null) return <View key={`blank-${index}`} style={m.calendarCell} />;
              const value = `${monthCursor.getFullYear()}-${`${monthCursor.getMonth() + 1}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
              const selected = value === selectedValue;
              return (
                <TouchableOpacity
                  key={value}
                  style={[m.calendarCell, selected && m.calendarCellSelected]}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[m.calendarCellText, selected && m.calendarCellTextSelected]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function ShowModal({ visible, existing, artistId, onClose, onSaved }: ShowModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [dateStr, setDateStr] = useState(
    existing?.show_date ? formatLocalDateInput(existing.show_date) : ''
  );
  const [timeStr, setTimeStr] = useState(
    existing?.show_date ? formatLocalTimeInput(existing.show_date) : ''
  );
  const [ticketUrl, setTicketUrl] = useState(existing?.ticket_url ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // reset when modal opens with new data
  React.useEffect(() => {
    if (visible) {
      setTitle(existing?.title ?? '');
      setVenue(existing?.venue ?? '');
      setCity(existing?.city ?? '');
      setDateStr(existing?.show_date ? formatLocalDateInput(existing.show_date) : '');
      setTimeStr(existing?.show_date ? formatLocalTimeInput(existing.show_date) : '');
      setTicketUrl(existing?.ticket_url ?? '');
      setDescription(existing?.description ?? '');
      setError('');
    }
  }, [visible, existing]);

  const handleSave = async () => {
    if (!title.trim()) { setError('SHOW TITLE IS REQUIRED.'); return; }
    if (!dateStr.trim()) { setError('DATE IS REQUIRED.'); return; }
    if (timeStr && !/^\d{2}:\d{2}$/.test(timeStr)) { setError('TIME MUST BE IN HH:MM FORMAT.'); return; }
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (hours > 23 || minutes > 59) { setError('TIME MUST BE VALID.'); return; }
    }

    const parsed = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
    if (isNaN(parsed.getTime())) { setError('INVALID DATE FORMAT. USE YYYY-MM-DD.'); return; }

    setSaving(true);
    setError('');
    const payload = {
      artist_id: artistId,
      title: title.trim(),
      venue: venue.trim() || null,
      city: city.trim() || null,
      show_date: parsed.toISOString(),
      ticket_url: ticketUrl.trim() || null,
      description: description.trim() || null,
    };

    let err;
    if (existing) {
      ({ error: err } = await supabase.from('shows').update(payload).eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('shows').insert(payload));
    }
    setSaving(false);
    if (err) { setError('COULD NOT SAVE — TRY AGAIN.'); return; }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        <View style={m.topBar}>
          <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
            <Text style={m.closeText}>✕ CANCEL</Text>
          </TouchableOpacity>
          <Text style={m.topTitle}>{existing ? 'EDIT SHOW' : 'ADD SHOW'}</Text>
          <View style={{ width: 80 }} />
        </View>
        <ScrollView style={m.scroll} keyboardShouldPersistTaps="handled">
          <LabeledInput label="SHOW TITLE *" value={title} onChangeText={setTitle} />
          <LabeledInput label="VENUE" value={venue} onChangeText={setVenue} placeholder="VENUE NAME" />
          <LabeledInput label="CITY" value={city} onChangeText={setCity} placeholder="CITY, COUNTRY" />
          <View style={m.fieldWrap}>
            <Text style={m.fieldLabel}>DATE *</Text>
            <TouchableOpacity style={m.dateButton} onPress={() => setDatePickerVisible(true)} activeOpacity={0.7}>
              <Text style={[m.dateButtonText, !dateStr && m.dateButtonPlaceholder]}>
                {dateStr ? prettySelectedDate(dateStr) : 'SELECT DATE'}
              </Text>
              <Text style={m.dateButtonIcon}>⌷</Text>
            </TouchableOpacity>
          </View>
          <LabeledInput
            label="TIME (OPTIONAL · HH:MM)"
            value={timeStr}
            onChangeText={(value) => setTimeStr(value.replace(/[^\d:]/g, '').slice(0, 5))}
            placeholder="19:30"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          <LabeledInput label="TICKET LINK (OPTIONAL)" value={ticketUrl} onChangeText={setTicketUrl} keyboardType="url" autoCapitalize="none" />
          <LabeledInput label="DESCRIPTION (OPTIONAL)" value={description} onChangeText={setDescription} multiline />

          {error ? <Text style={m.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[m.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? <ActivityIndicator color={colors.black} /> : (
              <Text style={m.saveBtnText}>{existing ? 'SAVE CHANGES' : 'ADD SHOW'}</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
        <DatePickerModal
          visible={datePickerVisible}
          selectedDate={dateStr}
          onClose={() => setDatePickerVisible(false)}
          onSelect={setDateStr}
        />
      </SafeAreaView>
    </Modal>
  );
}

function LabeledInput({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
}) {
  return (
    <View style={m.fieldWrap}>
      <Text style={m.fieldLabel}>{label}</Text>
      <TextInput
        style={[m.fieldInput, multiline && m.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#333333"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        multiline={multiline}
      />
    </View>
  );
}

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  closeBtn: { minWidth: 80 },
  closeText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  topTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  scroll: { flex: 1 },
  fieldWrap: { paddingHorizontal: 16, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: '#111111' },
  fieldLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, marginBottom: 8 },
  fieldInput: {
    color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.08,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  dateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  dateSheet: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222222',
    padding: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateArrow: { color: colors.white, fontFamily: MONO, fontSize: 22, paddingHorizontal: 8 },
  dateTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.08,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellSelected: {
    backgroundColor: colors.red,
  },
  calendarCellText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 11,
  },
  calendarCellTextSelected: {
    color: colors.white,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#222222',
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateButtonText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.08,
  },
  dateButtonPlaceholder: {
    color: '#333333',
  },
  dateButtonIcon: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 14,
  },
  error: { color: colors.red, fontFamily: MONO, fontSize: 11, marginHorizontal: 16, marginTop: 12 },
  saveBtn: {
    backgroundColor: colors.red, marginHorizontal: 16, marginTop: 24,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ManageShowsScreen() {
  const navigation = useNavigation<any>();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);

  const loadShows = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setArtistId(user.id);
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('artist_id', user.id)
      .order('show_date', { ascending: true });
    if (data) setShows(data as Show[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadShows(); }, [loadShows]));

  const handleDelete = (show: Show) => {
    Alert.alert('DELETE SHOW', `Remove "${show.title}"?`, [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE', style: 'destructive',
        onPress: async () => {
          await supabase.from('shows').delete().eq('id', show.id);
          setShows(prev => prev.filter(s => s.id !== show.id));
        },
      },
    ]);
  };

  const upcoming = shows.filter(s => !isPast(s.show_date));
  const past = shows.filter(s => isPast(s.show_date));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>PROFILE</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>MY SHOWS</Text>
        <TouchableOpacity
          onPress={() => { setEditingShow(null); setModalVisible(true); }}
          style={styles.addBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {shows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NO SHOWS YET</Text>
              <Text style={styles.emptySub}>ADD YOUR UPCOMING GIGS, EXHIBITIONS, AND PERFORMANCES.</Text>
            </View>
          ) : null}

          {upcoming.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>UPCOMING</Text>
              {upcoming.map(show => (
                <ShowRow key={show.id} show={show} onEdit={() => { setEditingShow(show); setModalVisible(true); }} onDelete={() => handleDelete(show)} />
              ))}
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>PAST</Text>
              {past.reverse().map(show => (
                <ShowRow key={show.id} show={show} onEdit={() => { setEditingShow(show); setModalVisible(true); }} onDelete={() => handleDelete(show)} isPast />
              ))}
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {artistId ? (
        <ShowModal
          visible={modalVisible}
          existing={editingShow}
          artistId={artistId}
          onClose={() => setModalVisible(false)}
          onSaved={() => { setModalVisible(false); loadShows(); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ShowRow({ show, onEdit, onDelete, isPast: past }: {
  show: Show; onEdit: () => void; onDelete: () => void; isPast?: boolean;
}) {
  return (
    <View style={[styles.showRow, past && styles.showRowPast]}>
      <View style={styles.showDateCol}>
        <Text style={[styles.showDateText, past && styles.showDateTextPast]}>
          {formatShowDate(show.show_date)}
        </Text>
      </View>
      <View style={styles.showInfo}>
        <Text style={[styles.showTitle, past && styles.showTitlePast]}>{show.title.toUpperCase()}</Text>
        {(show.venue || show.city) ? (
          <Text style={styles.showMeta}>
            {[show.venue, show.city].filter(Boolean).join(' · ').toUpperCase()}
          </Text>
        ) : null}
      </View>
      <View style={styles.showActions}>
        <TouchableOpacity onPress={onEdit} style={styles.showActionBtn} activeOpacity={0.7}>
          <Text style={styles.showActionEdit}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.showActionBtn} activeOpacity={0.7}>
          <Text style={styles.showActionDelete}>DEL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  addBtn: { borderWidth: 1, borderColor: colors.red, paddingHorizontal: 10, paddingVertical: 5 },
  addBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  sectionLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.25,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
  },
  showRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
    gap: 10,
  },
  showRowPast: { opacity: 0.5 },
  showDateCol: { width: 80 },
  showDateText: { color: '#f6c55a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, lineHeight: 15 },
  showDateTextPast: { color: '#9a9a9a' },
  showInfo: { flex: 1 },
  showTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 3 },
  showTitlePast: { color: '#9a9a9a' },
  showMeta: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  showActions: { flexDirection: 'row', gap: 10 },
  showActionBtn: { padding: 4 },
  showActionEdit: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  showActionDelete: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, opacity: 0.6 },
  empty: { paddingTop: 60, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  emptySub: { color: '#333333', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, textAlign: 'center', lineHeight: 16 },
});
