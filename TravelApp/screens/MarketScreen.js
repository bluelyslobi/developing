import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Modal, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, getDocs, onSnapshot, orderBy, query, where, serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import ChatScreen from './ChatScreen';

const categories = ['전체', '캐리어', '배낭', '여행용품', '전자기기', '등산용품', '스포츠'];
const sellCategories = ['캐리어', '배낭', '여행용품', '전자기기', '등산용품', '스포츠'];
const conditions = ['상', '중', '하'];

const EMPTY_FORM = { title: '', price: '', category: '캐리어', condition: '상', location: '', description: '' };

export default function MarketScreen() {
  const { user, userProfile } = useAuth();

  const [filterSelected, setFilterSelected] = useState('전체');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // 상품 상세 모달
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // 판매 등록 모달
  const [sellVisible, setSellVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUri, setImageUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 채팅 모달
  const [chatVisible, setChatVisible] = useState(false);
  const [chatProduct, setChatProduct] = useState(null);

  // Firestore 실시간 리스너
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProductsLoading(false);
    }, () => setProductsLoading(false));
    return unsub;
  }, []);

  const filtered = filterSelected === '전체'
    ? products
    : products.filter(p => p.category === filterSelected);

  // 이미지 선택 (로컬 미리보기 — 업로드는 등록 버튼 시)
  async function handlePickImage() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function handleSell() {
    if (!form.title.trim()) { Alert.alert('입력 오류', '상품명을 입력해주세요.'); return; }
    if (!form.price.trim()) { Alert.alert('입력 오류', '가격을 입력해주세요.'); return; }
    if (!form.location.trim()) { Alert.alert('입력 오류', '거래 지역을 입력해주세요.'); return; }

    setSubmitting(true);
    let imageUrl = null;
    try {
      if (imageUri) {
        setUploading(true);
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        const storageRef = ref(storage, `products/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
        setUploading(false);
      }
      await addDoc(collection(db, 'products'), {
        uid: user.uid,
        author: userProfile?.nickname || user.displayName || user.email,
        title: form.title.trim(),
        price: form.price.trim().replace(/[^0-9]/g, ''),
        category: form.category,
        condition: form.condition,
        location: form.location.trim(),
        description: form.description.trim(),
        image: imageUrl,
        status: '판매중',
        createdAt: serverTimestamp(),
      });
      setSellVisible(false);
      setForm(EMPTY_FORM);
      setImageUri(null);
    } catch {
      Alert.alert('오류', '상품 등록에 실패했습니다. Firebase Storage가 활성화되어 있는지 확인해주세요.');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  async function handleSoldOut(product) {
    Alert.alert('판매완료 처리', '이 상품을 판매완료로 변경할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '확인', onPress: async () => {
          try {
            await updateDoc(doc(db, 'products', product.id), { status: '판매완료' });
            setSelectedProduct(prev => ({ ...prev, status: '판매완료' }));
          } catch {
            Alert.alert('오류', '처리에 실패했습니다.');
          }
        }
      }
    ]);
  }

  async function handleDeleteProduct(product) {
    Alert.alert('삭제 확인', '이 상품을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'products', product.id));
            setDetailVisible(false);
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        }
      }
    ]);
  }

  function handleReportProduct(product) {
    if (!user) { Alert.alert('로그인 필요', '신고는 로그인 후 이용할 수 있습니다.'); return; }
    Alert.alert('신고', '이 상품을 신고하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '신고하기', style: 'destructive', onPress: async () => {
        try {
          const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('targetId', '==', product.id)));
          if (!snap.empty) { Alert.alert('알림', '이미 신고한 상품입니다.'); return; }
          await addDoc(collection(db, 'reports'), {
            uid: user.uid, targetId: product.id, targetType: 'product',
            reason: '부적절한 상품', createdAt: serverTimestamp(),
          });
          Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 처리됩니다.');
        } catch { Alert.alert('오류', '신고에 실패했습니다.'); }
      }},
    ]);
  }

  function handleChat(product) {
    if (!user) {
      Alert.alert('로그인 필요', '채팅은 로그인 후 이용할 수 있습니다.');
      return;
    }
    if (product.uid === user.uid) {
      Alert.alert('안내', '자신의 상품에는 채팅할 수 없습니다.');
      return;
    }
    setDetailVisible(false);
    setChatProduct(product);
    setChatVisible(true);
  }

  const priceDisplay = (p) => p.price
    ? `₩ ${Number(p.price).toLocaleString()}`
    : '-';

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>여행용품 중고거래</Text>
        <TouchableOpacity
          style={styles.sellBtn}
          onPress={() => {
            if (!user) { Alert.alert('로그인 필요', '판매 등록은 로그인 후 이용할 수 있습니다.'); return; }
            setForm(EMPTY_FORM); setImageUri(null); setSellVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.sellBtnText}>판매하기</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 필터 */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, filterSelected === cat && styles.filterChipActive]}
              onPress={() => setFilterSelected(cat)}
            >
              <Text style={[styles.filterText, filterSelected === cat && styles.filterTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 상품 목록 */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {productsLoading ? (
          <ActivityIndicator color="#FF6B6B" size="large" style={{ marginTop: 60 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧳</Text>
            <Text style={styles.emptyText}>등록된 상품이 없습니다.</Text>
            <Text style={styles.emptySubText}>첫 번째 여행용품을 판매해보세요!</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => { setSelectedProduct(item); setDetailVisible(true); }}
              >
                {item.image
                  ? <Image source={{ uri: item.image }} style={styles.itemImage} />
                  : <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                      <Ionicons name="image-outline" size={36} color="#ddd" />
                    </View>
                }
                {item.status === '판매완료' && (
                  <View style={styles.soldOverlay}>
                    <Text style={styles.soldOverlayText}>판매완료</Text>
                  </View>
                )}
                <View style={styles.conditionBadge}>
                  <Text style={styles.conditionText}>상태 {item.condition}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemPrice}>{priceDisplay(item)}</Text>
                  <View style={styles.itemMeta}>
                    <Ionicons name="location-outline" size={11} color="#999" />
                    <Text style={styles.itemLocation}>{item.location || '-'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 상품 상세 모달 */}
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        {selectedProduct && (
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <ScrollView>
              {selectedProduct.image
                ? <Image source={{ uri: selectedProduct.image }} style={styles.modalImage} />
                : <View style={[styles.modalImage, styles.modalImagePlaceholder]}>
                    <Ionicons name="image-outline" size={60} color="#ddd" />
                  </View>
              }
              <View style={styles.modalBody}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{selectedProduct.category}</Text>
                </View>
                <Text style={styles.modalTitle}>{selectedProduct.title}</Text>
                <Text style={styles.modalPrice}>{priceDisplay(selectedProduct)}</Text>
                <View style={styles.sellerRow}>
                  <Ionicons name="person-circle-outline" size={32} color="#4ECDC4" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.sellerName}>{selectedProduct.author}</Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={13} color="#999" />
                      <Text style={styles.locationText}>{selectedProduct.location}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.infoLabel}>상품 상태</Text>
                <Text style={styles.infoValue}>상태 {selectedProduct.condition}</Text>
                {selectedProduct.description ? (
                  <>
                    <Text style={styles.infoLabel}>상품 설명</Text>
                    <Text style={styles.infoValue}>{selectedProduct.description}</Text>
                  </>
                ) : null}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              {user && selectedProduct.uid === user.uid ? (
                <>
                  <TouchableOpacity
                    style={[styles.chatBtn, { flex: 1, borderColor: selectedProduct.status === '판매완료' ? '#ccc' : '#FF6B6B' }]}
                    onPress={() => handleSoldOut(selectedProduct)}
                    disabled={selectedProduct.status === '판매완료'}
                  >
                    <Text style={[styles.chatBtnText, { color: selectedProduct.status === '판매완료' ? '#ccc' : '#FF6B6B' }]}>
                      {selectedProduct.status === '판매완료' ? '판매완료됨' : '판매완료 처리'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buyBtn, { backgroundColor: '#999' }]} onPress={() => handleDeleteProduct(selectedProduct)}>
                    <Text style={styles.buyBtnText}>삭제하기</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => handleReportProduct(selectedProduct)} style={styles.reportBtn}>
                    <Ionicons name="flag-outline" size={18} color="#ccc" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chatBtn, selectedProduct.status === '판매완료' && { borderColor: '#ccc' }]}
                    onPress={() => handleChat(selectedProduct)}
                    disabled={selectedProduct.status === '판매완료'}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={selectedProduct.status === '판매완료' ? '#ccc' : '#4ECDC4'} />
                    <Text style={[styles.chatBtnText, selectedProduct.status === '판매완료' && { color: '#ccc' }]}>채팅하기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buyBtn, selectedProduct.status === '판매완료' && { backgroundColor: '#ccc' }]}
                    onPress={() => handleChat(selectedProduct)}
                    disabled={selectedProduct.status === '판매완료'}
                  >
                    <Text style={styles.buyBtnText}>{selectedProduct.status === '판매완료' ? '판매완료' : '구매하기'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* 판매 등록 모달 */}
      <Modal visible={sellVisible} animationType="slide" onRequestClose={() => setSellVisible(false)}>
        <View style={styles.sellModalContainer}>
          <View style={styles.sellModalHeader}>
            <TouchableOpacity onPress={() => setSellVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.sellModalTitle}>상품 등록</Text>
            <TouchableOpacity onPress={handleSell} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#FF6B6B" />
                : <Text style={styles.submitText}>등록</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 이미지 */}
            <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
              {imageUri
                ? <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                : <View style={styles.imagePlaceholder}>
                    {uploading
                      ? <ActivityIndicator color="#FF6B6B" />
                      : <>
                          <Ionicons name="camera-outline" size={32} color="#ccc" />
                          <Text style={styles.imagePlaceholderText}>사진 추가 (선택)</Text>
                        </>
                    }
                  </View>
              }
            </TouchableOpacity>

            <Text style={styles.labelText}>카테고리</Text>
            <View style={styles.chipWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
                {sellCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, form.category === cat && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}
                  >
                    <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.labelText}>상품명</Text>
            <TextInput style={styles.input} placeholder="상품명을 입력하세요" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} maxLength={50} />

            <Text style={styles.labelText}>가격 (원)</Text>
            <TextInput style={styles.input} placeholder="예: 35000" value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="numeric" />

            <Text style={styles.labelText}>상태</Text>
            <View style={styles.chipWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
                {conditions.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, form.condition === c && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, condition: c }))}
                  >
                    <Text style={[styles.chipText, form.condition === c && styles.chipTextActive]}>
                      {c === '상' ? '상 (거의 새것)' : c === '중' ? '중 (사용감 있음)' : '하 (기능 이상 없음)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.labelText}>거래 지역</Text>
            <TextInput style={styles.input} placeholder="예: 서울 강남" value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} />

            <Text style={styles.labelText}>상품 설명 (선택)</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="상품 상태, 구매 시기, 거래 방법 등을 자유롭게 적어주세요." value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline numberOfLines={5} textAlignVertical="top" />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* 채팅 */}
      <ChatScreen
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        product={chatProduct}
        currentUser={user}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  sellBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B6B', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  sellBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  filterWrapper: { backgroundColor: '#fff', paddingVertical: 10 },
  filterContent: { paddingHorizontal: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  filterChipActive: { backgroundColor: '#FF6B6B' },
  filterText: { fontSize: 13, color: '#666' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#999' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  itemCard: { width: '47%', margin: '1.5%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  itemImage: { width: '100%', height: 130 },
  itemImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  soldOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  soldOverlayText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  conditionBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  conditionText: { color: '#fff', fontSize: 10 },
  itemInfo: { padding: 10 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#FF6B6B', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center' },
  itemLocation: { fontSize: 11, color: '#999', marginLeft: 2 },
  // 상세 모달
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  closeBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 6 },
  modalImage: { width: '100%', height: 280 },
  modalImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  modalBody: { padding: 20 },
  categoryTag: { backgroundColor: '#FFF0F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  categoryTagText: { color: '#FF6B6B', fontSize: 12, fontWeight: 'bold' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 6 },
  modalPrice: { fontSize: 24, fontWeight: 'bold', color: '#FF6B6B', marginBottom: 16 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sellerName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  locationText: { fontSize: 12, color: '#999', marginLeft: 2 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },
  infoLabel: { fontSize: 13, fontWeight: 'bold', color: '#999', marginBottom: 4 },
  infoValue: { fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 22 },
  modalFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  reportBtn: { justifyContent: 'center', alignItems: 'center', padding: 14, marginRight: 8 },
  chatBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#4ECDC4', borderRadius: 12, padding: 14, marginRight: 8 },
  chatBtnText: { color: '#4ECDC4', fontWeight: 'bold', marginLeft: 6 },
  buyBtn: { flex: 2, backgroundColor: '#FF6B6B', borderRadius: 12, padding: 14, alignItems: 'center' },
  buyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  // 판매 등록 모달
  sellModalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 50 },
  sellModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sellModalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A2E' },
  submitText: { fontSize: 15, color: '#FF6B6B', fontWeight: 'bold' },
  imagePickerBtn: { marginBottom: 20 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  imagePlaceholder: { width: '100%', height: 150, backgroundColor: '#F5F5F5', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { color: '#ccc', fontSize: 13, marginTop: 8 },
  labelText: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  chipWrapper: { marginBottom: 16 },
  chipContent: { paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  chipActive: { backgroundColor: '#FF6B6B' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  textArea: { height: 120, textAlignVertical: 'top' },
});
