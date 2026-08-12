import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Image, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const MODAL_TITLES = {
  sales: '판매 내역',
  purchases: '구매 내역',
  likes: '찜한 팁',
  edit: '프로필 수정',
  reservations: '예약한 패키지',
};

const menuItems = [
  { icon: 'heart-outline',      label: '찜한 팁',      color: '#FF6B6B', key: 'likes'     },
  { icon: 'bag-handle-outline', label: '구매 내역',    color: '#4ECDC4', key: 'purchases' },
  { icon: 'storefront-outline', label: '판매 내역',    color: '#FFE66D', key: 'sales'     },
  { icon: 'airplane-outline',   label: '예약한 패키지', color: '#A8E6CF', key: 'reservations' },
];

function LoginScreen() {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'signup' && !nickname.trim()) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signUp(email.trim(), password, nickname.trim());
      }
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.'
        : e.code === 'auth/invalid-email' ? '이메일 형식이 올바르지 않습니다.'
        : e.code === 'auth/weak-password' ? '비밀번호는 6자 이상이어야 합니다.'
        : e.code === 'auth/invalid-credential' ? '이메일 또는 비밀번호가 틀렸습니다.'
        : '오류가 발생했습니다. 다시 시도해주세요.';
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.loginScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.loginHeader}>
          <Text style={styles.loginLogo}>✈️</Text>
          <Text style={styles.loginTitle}>트래블시커</Text>
          <Text style={styles.loginSub}>여행 커뮤니티 + 중고거래 + 패키지</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginCardTitle}>{mode === 'login' ? '로그인' : '회원가입'}</Text>

          {mode === 'signup' && (
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="닉네임"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>{mode === 'login' ? '로그인' : '가입하기'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {mode === 'login' ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
              <Text style={styles.toggleLink}>{mode === 'login' ? '회원가입' : '로그인'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function ProfileScreen() {
  const { user, userProfile, setUserProfile, loading, logout, deleteAccount } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // 회원 탈퇴
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 모달 공통
  const [activeModal, setActiveModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // 각 탭 데이터
  const [salesList,       setSalesList]       = useState([]);
  const [purchaseList,    setPurchaseList]    = useState([]);
  const [likedList,       setLikedList]       = useState([]);
  const [reservationList, setReservationList] = useState([]);

  // 프로필 수정
  const [editNickname, setEditNickname] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#4ECDC4" size="large" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  const displayName = userProfile?.nickname || user.displayName || user.email;
  const postCount   = userProfile?.postCount   ?? 0;
  const likeCount   = userProfile?.likeCount   ?? 0;
  const followCount = userProfile?.followCount  ?? 0;

  async function openModal(key) {
    if (key === 'edit') {
      setEditNickname(userProfile?.nickname || '');
      setActiveModal('edit');
      return;
    }
    setActiveModal(key);
    setModalLoading(true);
    try {
      if (key === 'sales') {
        const snap = await getDocs(query(collection(db, 'products'), where('uid', '==', user.uid)));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSalesList(items);
      } else if (key === 'purchases') {
        const snap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', user.uid)));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.participants?.[0] === user.uid)
          .sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));
        setPurchaseList(items);
      } else if (key === 'likes') {
        const snap = await getDocs(query(collection(db, 'posts'), where('likedBy', 'array-contains', user.uid)));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setLikedList(items);
      } else if (key === 'reservations') {
        const snap = await getDocs(query(collection(db, 'reservations'), where('uid', '==', user.uid)));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReservationList(items);
      }
    } catch {
      Alert.alert('오류', '데이터를 불러오지 못했습니다.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!editNickname.trim()) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { nickname: editNickname.trim() });
      setUserProfile({ ...userProfile, nickname: editNickname.trim() });
      setActiveModal(null);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      Alert.alert('입력 오류', '비밀번호를 입력해주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setDeleteModalVisible(false);
      setDeletePassword('');
    } catch (e) {
      const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? '비밀번호가 올바르지 않습니다.'
        : e.code === 'auth/too-many-requests'
        ? '잠시 후 다시 시도해주세요.'
        : '탈퇴 처리에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', msg);
    } finally {
      setDeleting(false);
    }
  }

  function renderModalContent() {
    if (modalLoading) {
      return <ActivityIndicator color="#4ECDC4" size="large" style={{ marginTop: 60 }} />;
    }

    if (activeModal === 'sales') {
      return (
        <FlatList
          data={salesList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>등록한 상품이 없습니다.</Text>}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.listCardSub}>₩{Number(item.price || 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.statusBadge, item.status === '판매완료' && styles.statusBadgeSold]}>
                <Text style={[styles.statusText, item.status === '판매완료' && styles.statusTextSold]}>
                  {item.status || '판매중'}
                </Text>
              </View>
            </View>
          )}
        />
      );
    }

    if (activeModal === 'purchases') {
      return (
        <FlatList
          data={purchaseList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>구매 문의한 상품이 없습니다.</Text>}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={[styles.menuIcon, { backgroundColor: '#4ECDC422', marginRight: 12 }]}>
                <Ionicons name="bag-handle-outline" size={20} color="#4ECDC4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle} numberOfLines={1}>{item.productTitle}</Text>
                <Text style={styles.listCardSub} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
            </View>
          )}
        />
      );
    }

    if (activeModal === 'likes') {
      return (
        <FlatList
          data={likedList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>찜한 팁이 없습니다.</Text>}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardDest}>{item.destination}</Text>
                <Text style={styles.listCardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.listCardSub} numberOfLines={1}>{item.content}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="heart" size={14} color="#FF6B6B" />
                <Text style={{ fontSize: 11, color: '#FF6B6B', marginTop: 2 }}>{item.likes ?? 0}</Text>
              </View>
            </View>
          )}
        />
      );
    }

    if (activeModal === 'reservations') {
      return (
        <FlatList
          data={reservationList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>예약한 패키지가 없습니다.</Text>}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              {item.packageImage
                ? <Image source={{ uri: item.packageImage }} style={styles.reservationImage} />
                : <View style={[styles.reservationImage, { backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="airplane-outline" size={20} color="#ddd" />
                  </View>
              }
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle} numberOfLines={1}>{item.packageTitle}</Text>
                <Text style={styles.listCardSub}>₩{Number(item.price || 0).toLocaleString()}/인</Text>
                {item.destination ? <Text style={{ fontSize: 11, color: '#4ECDC4', marginTop: 2 }}>{item.destination}{item.duration ? ` · ${item.duration}` : ''}</Text> : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: '#A8E6CF33' }]}>
                <Text style={[styles.statusText, { color: '#2E7D52' }]}>{item.status || '예약중'}</Text>
              </View>
            </View>
          )}
        />
      );
    }

    if (activeModal === 'edit') {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editContainer}>
            <Text style={styles.editLabel}>닉네임</Text>
            <TextInput
              style={styles.profileInput}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="새 닉네임 입력"
              maxLength={20}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>저장하기</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );
    }

    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user.photoURL || `https://picsum.photos/80/80?random=${user.uid.slice(0, 5)}` }}
            style={styles.profileImg}
          />
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{postCount}</Text>
              <Text style={styles.statLabel}>팁 공유</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{likeCount}</Text>
              <Text style={styles.statLabel}>받은 좋아요</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{followCount}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => openModal('edit')}>
            <Text style={styles.editBtnText}>프로필 수정</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>메뉴</Text>
        <View style={styles.menuContainer}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.menuItem}
              onPress={() => item.key && openModal(item.key)}
              activeOpacity={item.key ? 0.6 : 1}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.menuLabel, !item.key && { color: '#bbb' }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={item.key ? '#ccc' : '#e5e5e5'} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut
            ? <ActivityIndicator color="#999" />
            : <Text style={styles.logoutText}>로그아웃</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.withdrawBtn}
          onPress={() => { setDeletePassword(''); setDeleteModalVisible(true); }}
        >
          <Text style={styles.withdrawText}>회원 탈퇴</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 슬라이드 모달 */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalBack}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{MODAL_TITLES[activeModal]}</Text>
            <View style={{ width: 40 }} />
          </View>
          {renderModalContent()}
        </View>
      </Modal>

      {/* 회원 탈퇴 확인 모달 */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.withdrawOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.withdrawCard}>
            <Text style={styles.withdrawTitle}>정말 탈퇴하시겠어요?</Text>
            <Text style={styles.withdrawDesc}>
              탈퇴 시 계정 정보가 삭제되며 되돌릴 수 없습니다.{'\n'}
              본인 확인을 위해 비밀번호를 입력해주세요.
            </Text>
            <TextInput
              style={styles.withdrawInput}
              placeholder="비밀번호"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoFocus
            />
            <View style={styles.withdrawBtnRow}>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, styles.withdrawCancelBtn]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.withdrawCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, styles.withdrawConfirmBtn]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.withdrawConfirmText}>탈퇴하기</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  // ── 로그인 화면
  loginScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  loginHeader: { alignItems: 'center', marginBottom: 32 },
  loginLogo: { fontSize: 52, marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 4 },
  loginSub: { fontSize: 13, color: '#888' },
  loginCard: { backgroundColor: '#fff', borderRadius: 18, padding: 24, elevation: 4 },
  loginCardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, marginBottom: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, color: '#333' },
  submitBtn: { backgroundColor: '#4ECDC4', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  toggleBtn: { alignItems: 'center', marginTop: 16 },
  toggleText: { fontSize: 13, color: '#888' },
  toggleLink: { color: '#4ECDC4', fontWeight: 'bold' },

  // ── 마이페이지
  profileHeader: { backgroundColor: '#1A1A2E', alignItems: 'center', padding: 30, paddingTop: 60 },
  profileImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#4ECDC4', marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  profileEmail: { fontSize: 12, color: '#888', marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statItem: { alignItems: 'center', paddingHorizontal: 20 },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#4ECDC4' },
  statLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#333' },
  editBtn: { borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  editBtnText: { color: '#4ECDC4', fontSize: 13, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', margin: 16, marginBottom: 8 },
  menuContainer: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', elevation: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, color: '#333' },
  logoutBtn: { margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  logoutText: { color: '#999', fontSize: 14 },
  withdrawBtn: { alignItems: 'center', marginBottom: 8 },
  withdrawText: { color: '#ccc', fontSize: 12, textDecorationLine: 'underline' },

  // ── 회원 탈퇴 모달
  withdrawOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  withdrawCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  withdrawTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 10, textAlign: 'center' },
  withdrawDesc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  withdrawInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 18 },
  withdrawBtnRow: { flexDirection: 'row' },
  withdrawActionBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  withdrawCancelBtn: { backgroundColor: '#F0F0F0', marginRight: 8 },
  withdrawCancelText: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  withdrawConfirmBtn: { backgroundColor: '#FF6B6B' },
  withdrawConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // ── 모달 공통
  modalContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalBack: { padding: 4, marginRight: 8 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: '#1A1A2E', textAlign: 'center' },

  // ── 목록 카드
  listContent: { padding: 16, paddingBottom: 40 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  listCardDest: { fontSize: 11, color: '#4ECDC4', fontWeight: 'bold', marginBottom: 2 },
  listCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 3 },
  listCardSub: { fontSize: 12, color: '#888' },
  statusBadge: { backgroundColor: '#4ECDC422', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeSold: { backgroundColor: '#F5F5F5' },
  statusText: { fontSize: 11, color: '#4ECDC4', fontWeight: 'bold' },
  statusTextSold: { color: '#bbb' },
  emptyText: { textAlign: 'center', color: '#bbb', fontSize: 14, marginTop: 60 },
  reservationImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },

  // ── 프로필 수정
  editContainer: { padding: 24 },
  editLabel: { fontSize: 13, color: '#888', marginBottom: 8 },
  profileInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1A1A2E', marginBottom: 20 },
  saveBtn: { backgroundColor: '#4ECDC4', borderRadius: 12, padding: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
