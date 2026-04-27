import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, Alert, ActivityIndicator,
  Modal, Image, FlatList, Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import VideoThumbnail from '../../components/VideoThumbnail';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB = (SCREEN_WIDTH - 34) / 3;

interface Post {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
}

interface PortfolioSection {
  id: string;
  title: string;
  cover_image_url: string | null;
  display_order: number;
  items: PortfolioItem[];
}

interface PortfolioItem {
  id: string;
  post_id: string;
  display_order: number;
  post?: Post;
}

function PortfolioPostPickerThumb({ post }: { post: Post }) {
  if (post.type === 'image' && post.media_url) {
    return <Image source={{ uri: post.media_url }} style={pp.thumbImg} resizeMode="cover" />;
  }

  if (post.type === 'video' && post.media_url) {
    return (
      <VideoThumbnail
        uri={post.media_url}
        label="VIDEO"
        containerStyle={pp.thumbImg}
        centerPlayStyle={pp.thumbIcon}
        labelStyle={pp.thumbTypeLabel}
      />
    );
  }

  return (
    <View style={pp.thumbText}>
      <Text style={pp.thumbSnippet} numberOfLines={3}>
        {(post.title ?? post.content ?? '').slice(0, 40).toUpperCase()}
      </Text>
    </View>
  );
}

function PortfolioItemThumb({ post }: { post?: Post }) {
  if (post?.type === 'image' && post.media_url) {
    return <Image source={{ uri: post.media_url }} style={styles.itemImg} resizeMode="cover" />;
  }

  if (post?.type === 'video' && post.media_url) {
    return (
      <VideoThumbnail
        uri={post.media_url}
        containerStyle={styles.itemImg}
        centerPlayStyle={styles.itemPlaceholderIcon}
      />
    );
  }

  return (
    <View style={styles.itemPlaceholder}>
      <Text style={styles.itemPlaceholderText} numberOfLines={2}>
        {(post?.title ?? post?.content ?? '').slice(0, 25).toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Section Title Modal ──────────────────────────────────────────────────────

function SectionTitleModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: string; onClose: () => void; onSave: (title: string) => void;
}) {
  const [val, setVal] = useState(initial);
  React.useEffect(() => { if (visible) setVal(initial); }, [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={sm.overlay}>
        <View style={sm.box}>
          <Text style={sm.title}>SECTION NAME</Text>
          <TextInput
            style={sm.input}
            value={val}
            onChangeText={setVal}
            placeholder="E.G. EDITORIAL WORK"
            placeholderTextColor="#333333"
            autoFocus
            maxLength={40}
          />
          <View style={sm.row}>
            <TouchableOpacity style={sm.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={sm.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sm.saveBtn, !val.trim() && { opacity: 0.4 }]}
              onPress={() => val.trim() && onSave(val.trim())}
              disabled={!val.trim()}
              activeOpacity={0.7}
            >
              <Text style={sm.saveText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  box: { width: SCREEN_WIDTH - 48, backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', padding: 20 },
  title: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 14 },
  input: {
    color: colors.white, fontFamily: MONO, fontSize: 13,
    borderBottomWidth: 1, borderBottomColor: '#333333',
    paddingBottom: 10, marginBottom: 20,
  },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#333333', height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11 },
  saveBtn: { flex: 1, backgroundColor: colors.red, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
});

// ─── Post Picker Modal ────────────────────────────────────────────────────────

function PostPickerModal({ visible, posts, alreadyAdded, onClose, onPick }: {
  visible: boolean; posts: Post[]; alreadyAdded: string[];
  onClose: () => void; onPick: (postId: string) => void;
}) {
  const available = posts.filter(p => !alreadyAdded.includes(p.id));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
        <View style={pp.topBar}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={pp.close}>✕ CANCEL</Text>
          </TouchableOpacity>
          <Text style={pp.title}>PICK A POST</Text>
          <View style={{ width: 60 }} />
        </View>
        {available.length === 0 ? (
          <View style={pp.empty}>
            <Text style={pp.emptyText}>ALL POSTS ARE ALREADY IN THIS SECTION.</Text>
          </View>
        ) : (
          <FlatList
            data={available}
            numColumns={3}
            keyExtractor={i => i.id}
            contentContainerStyle={pp.grid}
            columnWrapperStyle={{ gap: 1 }}
            ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={pp.thumb} onPress={() => onPick(item.id)} activeOpacity={0.8}>
                <PortfolioPostPickerThumb post={item} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const pp = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  close: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  title: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  grid: { padding: 1 },
  thumb: { width: THUMB, height: THUMB, backgroundColor: '#111111' },
  thumbImg: { width: '100%', height: '100%' },
  thumbText: {
    width: '100%', height: '100%', backgroundColor: '#0d0d0d',
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  thumbIcon: { color: colors.red, fontSize: 22 },
  thumbTypeLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, marginTop: 4 },
  thumbSnippet: { color: '#888888', fontFamily: MONO, fontSize: 10, textAlign: 'center', lineHeight: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ManagePortfolioScreen() {
  const navigation = useNavigation<any>();
  const [sections, setSections] = useState<PortfolioSection[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistId, setArtistId] = useState<string | null>(null);

  // Section title modal
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<PortfolioSection | null>(null);

  // Post picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setArtistId(user.id);

    // Load all posts for this artist
    const { data: postData } = await supabase
      .from('posts')
      .select('id, type, title, content, media_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Load portfolio sections + items
    const { data: sectionData } = await supabase
      .from('portfolio_sections')
      .select('id, title, cover_image_url, display_order')
      .eq('artist_id', user.id)
      .order('display_order', { ascending: true });

    const postMap: Record<string, Post> = {};
    (postData ?? []).forEach((p: any) => { postMap[p.id] = p as Post; });

    const enrichedSections: PortfolioSection[] = [];
    for (const sec of (sectionData ?? []) as any[]) {
      const { data: itemData } = await supabase
        .from('portfolio_items')
        .select('id, post_id, display_order')
        .eq('section_id', sec.id)
        .order('display_order', { ascending: true });

      enrichedSections.push({
        ...sec,
        items: (itemData ?? []).map((item: any) => ({
          ...item,
          post: postMap[item.post_id],
        })),
      });
    }

    setAllPosts((postData ?? []) as Post[]);
    setSections(enrichedSections);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAddSection = () => {
    setEditingSection(null);
    setTitleModalVisible(true);
  };

  const handleSaveSectionTitle = async (title: string) => {
    if (!artistId) return;
    setTitleModalVisible(false);
    if (editingSection) {
      await supabase.from('portfolio_sections').update({ title }).eq('id', editingSection.id);
    } else {
      const nextOrder = sections.length;
      await supabase.from('portfolio_sections').insert({
        artist_id: artistId, title, display_order: nextOrder,
      });
    }
    loadData();
  };

  const handleDeleteSection = (sec: PortfolioSection) => {
    Alert.alert('DELETE SECTION', `Remove "${sec.title}" and all its items?`, [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE', style: 'destructive',
        onPress: async () => {
          await supabase.from('portfolio_sections').delete().eq('id', sec.id);
          loadData();
        },
      },
    ]);
  };

  const openPostPicker = (sectionId: string) => {
    setTargetSectionId(sectionId);
    setPickerVisible(true);
  };

  const handlePickPost = async (postId: string) => {
    if (!targetSectionId) return;
    setPickerVisible(false);
    const targetSection = sections.find(s => s.id === targetSectionId);
    const nextOrder = targetSection?.items.length ?? 0;
    await supabase.from('portfolio_items').insert({
      section_id: targetSectionId, post_id: postId, display_order: nextOrder,
    });
    loadData();
  };

  const handleRemoveItem = async (itemId: string) => {
    await supabase.from('portfolio_items').delete().eq('id', itemId);
    loadData();
  };

  const handleUpCover = async (sec: PortfolioSection) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (result.canceled || !artistId) return;
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${artistId}/portfolio_covers/${sec.id}.${ext}`;
    const response = await fetch(uri);
    const buf = await response.arrayBuffer();
    const { error: upErr } = await supabase.storage.from('posts').upload(path, buf, { contentType: `image/${ext}`, upsert: true });
    if (upErr) { Alert.alert('ERROR', 'Could not upload cover.'); return; }
    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
    await supabase.from('portfolio_sections').update({ cover_image_url: urlData.publicUrl }).eq('id', sec.id);
    loadData();
  };

  // all post IDs already in this section (for picker filtering)
  const getAddedIds = (sec: PortfolioSection) => sec.items.map(i => i.post_id);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>PROFILE</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>MY PORTFOLIO</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.doneBtn} activeOpacity={0.7}>
          <Text style={styles.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {sections.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NO SECTIONS YET</Text>
              <Text style={styles.emptySub}>
                CREATE SECTIONS LIKE "EDITORIAL WORK", "COMMISSIONS", OR "LIVE SHOWS" TO ORGANIZE YOUR PORTFOLIO.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAddSection} activeOpacity={0.7}>
                <Text style={styles.emptyBtnText}>+ ADD FIRST SECTION</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {sections.map((sec) => (
            <View key={sec.id} style={styles.section}>
              {/* Section header */}
              <View style={styles.secHeader}>
                <TouchableOpacity onPress={() => handleUpCover(sec)} activeOpacity={0.8}>
                  {sec.cover_image_url ? (
                    <Image source={{ uri: sec.cover_image_url }} style={styles.secCover} />
                  ) : (
                    <View style={styles.secCoverPlaceholder}>
                      <Text style={styles.secCoverPlaceholderText}>+ COVER</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secInfo}
                  onPress={() => { setEditingSection(sec); setTitleModalVisible(true); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.secTitleRow}>
                    <Text style={styles.secTitle}>{sec.title.toUpperCase()}</Text>
                    <Text style={styles.secEditIcon}> ✎</Text>
                  </View>
                  <Text style={styles.secCount}>{sec.items.length} {sec.items.length === 1 ? 'PIECE' : 'PIECES'}</Text>
                </TouchableOpacity>
                <View style={styles.secActions}>
                  <TouchableOpacity
                    onPress={() => { setEditingSection(sec); setTitleModalVisible(true); }}
                    style={styles.secActionBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secActionEdit}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSection(sec)}
                    style={[styles.secActionBtn, styles.secDeleteBtn]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secActionDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items grid */}
              <View style={styles.itemsGrid}>
                {sec.items.map((item) => (
                  <View key={item.id} style={styles.itemThumb}>
                    <PortfolioItemThumb post={item.post} />
                    <TouchableOpacity
                      style={styles.itemRemoveBtn}
                      onPress={() => handleRemoveItem(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.itemRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add piece button */}
                <TouchableOpacity
                  style={styles.itemAddBtn}
                  onPress={() => openPostPicker(sec.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemAddIcon}>+</Text>
                  <Text style={styles.itemAddText}>ADD{'\n'}PIECE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Sticky bottom add-section bar */}
      {!loading && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomAddBtn} onPress={handleAddSection} activeOpacity={0.7}>
            <Text style={styles.bottomAddText}>+ ADD SECTION</Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionTitleModal
        visible={titleModalVisible}
        initial={editingSection?.title ?? ''}
        onClose={() => setTitleModalVisible(false)}
        onSave={handleSaveSectionTitle}
      />

      <PostPickerModal
        visible={pickerVisible}
        posts={allPosts}
        alreadyAdded={sections.find(s => s.id === targetSectionId)?.items.map(i => i.post_id) ?? []}
        onClose={() => setPickerVisible(false)}
        onPick={handlePickPost}
      />
    </SafeAreaView>
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
  doneBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  doneBtnText: { color: '#f6c55a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: colors.black, paddingBottom: 30, paddingTop: 10,
    paddingHorizontal: 16,
  },
  bottomAddBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingVertical: 14, alignItems: 'center',
  },
  bottomAddText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  empty: { paddingTop: 60, paddingHorizontal: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  emptySub: { color: '#333333', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, textAlign: 'center', lineHeight: 16 },
  emptyBtn: { borderWidth: 1, borderColor: colors.red, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  section: { borderBottomWidth: 1, borderBottomColor: '#111111', paddingBottom: 16 },
  secHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  secCover: { width: 56, height: 42, backgroundColor: '#111111' },
  secCoverPlaceholder: {
    width: 56, height: 42, borderWidth: 1, borderColor: '#222222',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  secCoverPlaceholderText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  secInfo: { flex: 1 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center' },
  secTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15, marginBottom: 3 },
  secEditIcon: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, marginBottom: 3 },
  secCount: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  secActions: { gap: 6, alignItems: 'flex-end' },
  secActionBtn: {
    borderWidth: 1, borderColor: '#333333',
    paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center',
  },
  secDeleteBtn: { borderColor: colors.red },
  secActionEdit: { color: '#888888', fontFamily: MONO, fontSize: 9, letterSpacing: 0.12 },
  secActionDelete: { color: colors.red, fontFamily: MONO, fontSize: 11 },

  itemsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 1,
    paddingHorizontal: 16,
  },
  itemThumb: { width: THUMB, height: THUMB, position: 'relative' },
  itemImg: { width: '100%', height: '100%' },
  itemPlaceholder: {
    width: '100%', height: '100%', backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  itemPlaceholderIcon: { color: colors.red, fontSize: 20 },
  itemPlaceholderText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, textAlign: 'center', lineHeight: 14 },
  itemRemoveBtn: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  itemRemoveText: { color: colors.white, fontFamily: MONO, fontSize: 13, lineHeight: 18 },
  itemAddBtn: {
    width: THUMB, height: THUMB,
    borderWidth: 1, borderColor: '#1a1a1a',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  itemAddIcon: { color: '#333333', fontFamily: MONO, fontSize: 20 },
  itemAddText: { color: '#333333', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, textAlign: 'center', lineHeight: 13 },
});
