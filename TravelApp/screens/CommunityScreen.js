import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Image, TextInput, Modal, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, getDocs, onSnapshot, orderBy, query, where, serverTimestamp, doc, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { pickAndUploadImage } from '../services/uploadImage';

const CURRENCY_CONFIG = [
  { key: 'JPY', flag: '🇯🇵', label: '엔화 (JPY)',  format: r => `100엔 = ₩${Math.round(100 / r).toLocaleString()}` },
  { key: 'USD', flag: '🇺🇸', label: '달러 (USD)', format: r => `1달러 = ₩${Math.round(1 / r).toLocaleString()}` },
  { key: 'EUR', flag: '🇪🇺', label: '유로 (EUR)', format: r => `1유로 = ₩${Math.round(1 / r).toLocaleString()}` },
  { key: 'THB', flag: '🇹🇭', label: '바트 (THB)', format: r => `1바트 = ₩${(1 / r).toFixed(1)}` },
];

const destinations = ['전체', '환전정보', '여행팁', '여행스토리'];
const writeDestinations = ['여행팁', '여행스토리', '환전정보'];

export default function CommunityScreen() {
  const { user, userProfile } = useAuth();
  const [selected, setSelected] = useState('전체');
  const [modalVisible, setModalVisible] = useState(false);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [ratesDate, setRatesDate] = useState('');
  const [ratesLoading, setRatesLoading] = useState(true);

  // Firestore 게시글 상태
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // 글쓰기 폼
  const [form, setForm] = useState({ destination: '여행팁', title: '', content: '' });
  const [postImageUri, setPostImageUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // 댓글
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentPost, setCommentPost] = useState(null);
  const [commentList, setCommentList] = useState([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Firestore 실시간 리스너
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(data);
      setPostsLoading(false);
    }, () => {
      setPostsLoading(false);
    });
    return unsubscribe;
  }, []);

  // 환율 API
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const symbols = 'USD,EUR,JPY,THB';
        const todayRes = await fetch(`https://api.frankfurter.app/latest?from=KRW&to=${symbols}`);
        const todayData = await todayRes.json();

        const prevDate = new Date(todayData.date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevStr = prevDate.toISOString().split('T')[0];
        const prevData = await fetch(`https://api.frankfurter.app/${prevStr}?from=KRW&to=${symbols}`)
          .then(r => r.json());

        const rates = CURRENCY_CONFIG.map(({ key, flag, label, format }) => {
          const todayRate = todayData.rates[key];
          const prevRate = prevData.rates[key];
          const krwToday = 1 / todayRate;
          const krwPrev = 1 / prevRate;
          const change = ((krwToday - krwPrev) / krwPrev * 100).toFixed(1);
          return { currency: label, flag, rate: format(todayRate), change: Math.abs(change).toFixed(1), up: parseFloat(change) >= 0 };
        });

        const d = new Date(todayData.date);
        setRatesDate(`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} 기준`);
        setExchangeRates(rates);
      } catch {
        // 네트워크 오류 시 빈 상태 유지
      } finally {
        setRatesLoading(false);
      }
    };
    fetchRates();
  }, []);

  const toggleLike = async (post) => {
    if (!user) {
      Alert.alert('로그인 필요', '좋아요는 로그인 후 이용할 수 있습니다.');
      return;
    }
    const alreadyLiked = post.likedBy?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        likes: increment(alreadyLiked ? -1 : 1),
        likedBy: alreadyLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch {
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
    }
  };

  const handleDelete = (post) => {
    Alert.alert('삭제 확인', '이 글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'posts', post.id));
            try { await updateDoc(doc(db, 'users', user.uid), { postCount: increment(-1) }); } catch {}
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        }
      }
    ]);
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `[트래블시커] ${post.title}\n\n${post.content}`,
      });
    } catch {
      // 사용자가 공유를 취소한 경우 등 — 무시
    }
  };

  const handleReport = (post) => {
    if (!user) { Alert.alert('로그인 필요', '신고는 로그인 후 이용할 수 있습니다.'); return; }
    Alert.alert('신고', '이 게시글을 신고하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '신고하기', style: 'destructive', onPress: async () => {
        try {
          const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('targetId', '==', post.id)));
          if (!snap.empty) { Alert.alert('알림', '이미 신고한 게시글입니다.'); return; }
          await addDoc(collection(db, 'reports'), {
            uid: user.uid, targetId: post.id, targetType: 'post',
            reason: '부적절한 게시글', createdAt: serverTimestamp(),
          });
          Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 처리됩니다.');
        } catch { Alert.alert('오류', '신고에 실패했습니다.'); }
      }},
    ]);
  };

  const handleWrite = () => {
    if (!user) {
      Alert.alert('로그인 필요', '글쓰기는 로그인 후 이용할 수 있습니다.\n마이 탭에서 로그인해 주세요.');
      return;
    }
    setForm({ destination: '여행팁', title: '', content: '' });
    setPostImageUri(null);
    setModalVisible(true);
  };

  async function handlePickPostImage() {
    const url = await pickAndUploadImage(`posts/${user.uid}_${Date.now()}`);
    if (url) setPostImageUri(url);
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { Alert.alert('입력 오류', '제목을 입력해주세요.'); return; }
    if (!form.content.trim()) { Alert.alert('입력 오류', '내용을 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        author: userProfile?.nickname || user.displayName || user.email,
        avatar: user.photoURL || `https://picsum.photos/40/40?random=${user.uid.slice(0, 4)}`,
        destination: form.destination,
        title: form.title.trim(),
        content: form.content.trim(),
        image: postImageUri || null,
        likes: 0,
        likedBy: [],
        comments: 0,
        createdAt: serverTimestamp(),
      });
      try { await updateDoc(doc(db, 'users', user.uid), { postCount: increment(1) }); } catch {}
      setModalVisible(false);
    } catch {
      Alert.alert('오류', '글 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = selected === '전체' ? posts : posts.filter(p => p.destination === selected);

  const openCommentModal = async (post) => {
    setCommentPost(post);
    setCommentList([]);
    setCommentText('');
    setCommentModalVisible(true);
    setCommentLoading(true);
    try {
      const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setCommentList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      // ignore
    } finally {
      setCommentLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user) { Alert.alert('로그인 필요', '댓글은 로그인 후 작성할 수 있습니다.'); return; }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, 'posts', commentPost.id, 'comments'), {
        uid: user.uid,
        author: userProfile?.nickname || user.email,
        avatar: user.photoURL || `https://picsum.photos/32/32?random=${user.uid.slice(0, 4)}`,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', commentPost.id), { comments: increment(1) });
      setCommentText('');
      const q = query(collection(db, 'posts', commentPost.id, 'comments'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setCommentList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      Alert.alert('오류', '댓글 등록에 실패했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    try {
      await deleteDoc(doc(db, 'posts', commentPost.id, 'comments', comment.id));
      await updateDoc(doc(db, 'posts', commentPost.id), { comments: increment(-1) });
      setCommentList(prev => prev.filter(c => c.id !== comment.id));
    } catch {
      Alert.alert('오류', '댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>여행 팁 커뮤니티</Text>
        <TouchableOpacity style={styles.writeBtn} onPress={handleWrite}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.writeBtnText}>글쓰기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {destinations.map(dest => (
            <TouchableOpacity
              key={dest}
              style={[styles.filterChip, selected === dest && styles.filterChipActive]}
              onPress={() => setSelected(dest)}
            >
              <Text style={[styles.filterText, selected === dest && styles.filterTextActive]}>{dest}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {selected === '환전정보' && (
          <View style={styles.rateCard}>
            <View style={styles.rateCardHeader}>
              <Ionicons name="swap-horizontal" size={18} color="#4ECDC4" />
              <Text style={styles.rateCardTitle}>오늘의 환율 정보</Text>
              <Text style={styles.rateCardDate}>{ratesDate}</Text>
            </View>
            {ratesLoading ? (
              <ActivityIndicator color="#4ECDC4" style={{ marginVertical: 16 }} />
            ) : exchangeRates.length === 0 ? (
              <Text style={{ color: '#999', textAlign: 'center', paddingVertical: 12 }}>환율 정보를 불러올 수 없습니다</Text>
            ) : null}
            {exchangeRates.map((item, idx) => (
              <View key={idx} style={styles.rateRow}>
                <Text style={styles.rateFlag}>{item.flag}</Text>
                <Text style={styles.rateCurrency}>{item.currency}</Text>
                <Text style={styles.rateValue}>{item.rate}</Text>
                <Text style={[styles.rateChange, { color: item.up ? '#FF6B6B' : '#4ECDC4' }]}>
                  {item.up ? '▲' : '▼'} {item.change}%
                </Text>
              </View>
            ))}
            <Text style={styles.rateDisclaimer}>※ 참고용 환율이며 실제 환율과 다를 수 있습니다</Text>
          </View>
        )}

        {postsLoading ? (
          <ActivityIndicator color="#4ECDC4" size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyText}>아직 글이 없습니다.</Text>
            <Text style={styles.emptySubText}>첫 번째 여행 팁을 공유해보세요!</Text>
          </View>
        ) : (
          filtered.map(post => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Image source={{ uri: post.avatar }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.author}>{post.author}</Text>
                  <Text style={[styles.destBadge, post.destination === '환전정보' && styles.destBadgeExchange]}>
                    {post.destination}
                  </Text>
                </View>
                {user && post.uid !== user.uid && (
                  <TouchableOpacity onPress={() => handleReport(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 8 }}>
                    <Ionicons name="flag-outline" size={18} color="#ccc" />
                  </TouchableOpacity>
                )}
                {user && post.uid === user.uid && (
                  <TouchableOpacity onPress={() => handleDelete(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#ccc" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
              {post.image && <Image source={{ uri: post.image }} style={styles.postImage} />}
              <View style={styles.postFooter}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)}>
                  <Ionicons name={user && post.likedBy?.includes(user.uid) ? 'heart' : 'heart-outline'} size={18} color="#FF6B6B" />
                  <Text style={styles.actionText}>{post.likedBy?.length ?? post.likes ?? 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openCommentModal(post)}>
                  <Ionicons name="chatbubble-outline" size={18} color="#4ECDC4" />
                  <Text style={styles.actionText}>{post.comments ?? 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                  <Ionicons name="share-social-outline" size={18} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 댓글 모달 */}
      <Modal visible={commentModalVisible} animationType="slide" onRequestClose={() => setCommentModalVisible(false)}>
        <View style={styles.commentModalContainer}>
          <View style={styles.commentModalHeader}>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.commentModalTitle}>댓글</Text>
            <View style={{ width: 32 }} />
          </View>
          {commentPost && (
            <View style={styles.commentPostPreview}>
              <Text style={styles.commentPostTitle} numberOfLines={2}>{commentPost.title}</Text>
            </View>
          )}
          {commentLoading ? (
            <ActivityIndicator color="#4ECDC4" size="large" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={commentList}
              keyExtractor={item => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#bbb', marginTop: 40, fontSize: 14 }}>첫 번째 댓글을 작성해보세요!</Text>}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <Image source={{ uri: item.avatar }} style={styles.commentAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentAuthor}>{item.author}</Text>
                    <Text style={styles.commentBody}>{item.text}</Text>
                  </View>
                  {user && item.uid === user.uid && (
                    <TouchableOpacity onPress={() => handleDeleteComment(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color="#ccc" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder={user ? '댓글을 입력하세요...' : '로그인 후 댓글을 작성할 수 있습니다'}
                value={commentText}
                onChangeText={setCommentText}
                editable={!!user}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, (!commentText.trim() || submittingComment) && { opacity: 0.4 }]}
                onPress={handleAddComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="send" size={16} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 글쓰기 모달 */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>여행 팁 공유</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#4ECDC4" />
                : <Text style={styles.submitText}>등록</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.labelText}>목적지</Text>
          <View style={styles.destPickerWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destPickerContent}>
              {writeDestinations.map(dest => (
                <TouchableOpacity
                  key={dest}
                  style={[styles.destChip, form.destination === dest && styles.destChipActive]}
                  onPress={() => setForm(f => ({ ...f, destination: dest }))}
                >
                  <Text style={[styles.destChipText, form.destination === dest && styles.destChipTextActive]}>{dest}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.labelText}>제목</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="제목을 입력하세요"
            value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))}
            maxLength={50}
          />

          <Text style={styles.labelText}>내용</Text>
          <TextInput
            style={[styles.modalInput, styles.modalTextArea]}
            placeholder="여행 팁을 자유롭게 공유해보세요!"
            value={form.content}
            onChangeText={v => setForm(f => ({ ...f, content: v }))}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          <Text style={styles.labelText}>사진 (선택)</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPostImage}>
            {postImageUri
              ? <Image source={{ uri: postImageUri }} style={styles.photoPreview} />
              : <>
                  <Ionicons name="camera-outline" size={22} color="#4ECDC4" />
                  <Text style={styles.photoBtnText}>사진 추가</Text>
                </>
            }
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  writeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4ECDC4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  writeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  filterWrapper: { backgroundColor: '#fff', paddingVertical: 10 },
  filterScrollContent: { paddingHorizontal: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  filterChipActive: { backgroundColor: '#4ECDC4' },
  filterText: { fontSize: 13, color: '#666' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  postCard: { backgroundColor: '#fff', margin: 12, borderRadius: 14, padding: 16, elevation: 2 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  author: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  destBadge: { fontSize: 11, color: '#4ECDC4' },
  destBadgeExchange: { color: '#FFE66D', backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', fontSize: 11 },
  postTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 6 },
  postContent: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 10 },
  postImage: { width: '100%', height: 160, borderRadius: 10, marginBottom: 12 },
  postFooter: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { fontSize: 13, color: '#999', marginLeft: 4 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#999' },
  // 글쓰기 모달
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A2E' },
  submitText: { fontSize: 15, color: '#4ECDC4', fontWeight: 'bold' },
  labelText: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  photoBtn: { borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', minHeight: 52, marginBottom: 16 },
  photoBtnText: { color: '#4ECDC4', fontWeight: 'bold', marginLeft: 8 },
  photoPreview: { width: '100%', height: 180, borderRadius: 10 },
  destPickerWrapper: { marginBottom: 16 },
  destPickerContent: { paddingRight: 8 },
  destChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  destChipActive: { backgroundColor: '#4ECDC4' },
  destChipText: { fontSize: 13, color: '#666' },
  destChipTextActive: { color: '#fff', fontWeight: 'bold' },
  modalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  modalTextArea: { height: 180, textAlignVertical: 'top' },
  // 댓글 모달
  commentModalContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  commentModalHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  commentModalTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: '#1A1A2E', textAlign: 'center' },
  commentPostPreview: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  commentPostTitle: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentAuthor: { fontSize: 12, fontWeight: 'bold', color: '#333', marginBottom: 3 },
  commentBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, maxHeight: 80, marginRight: 8 },
  commentSendBtn: { backgroundColor: '#4ECDC4', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  // 환율 카드
  rateCard: { backgroundColor: '#1A1A2E', margin: 12, marginTop: 20, borderRadius: 14, padding: 16 },
  rateCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  rateCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginLeft: 6, flex: 1 },
  rateCardDate: { fontSize: 11, color: '#999' },
  rateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2A2A3E' },
  rateFlag: { fontSize: 20, marginRight: 10 },
  rateCurrency: { fontSize: 13, color: '#ccc', flex: 1 },
  rateValue: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginRight: 10 },
  rateChange: { fontSize: 12, fontWeight: 'bold', minWidth: 60, textAlign: 'right' },
  rateDisclaimer: { fontSize: 10, color: '#666', marginTop: 10, textAlign: 'center' },
});
