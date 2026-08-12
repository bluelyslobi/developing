import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Modal, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, where, onSnapshot, addDoc, getDocs, serverTimestamp, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

const TAG_OPTIONS = ['항공포함', '호텔3성', '호텔4성', '리조트', '가이드포함', '투어포함', '자유여행', '허니문'];
const EMPTY_FORM = { title: '', destination: '', duration: '', price: '', originalPrice: '', tags: [], includes: '', schedule: '' };

export default function PackageScreen() {
  const { user, userProfile } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [addVisible, setAddVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUri, setImageUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // 리뷰
  const [reviewList, setReviewList] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  // 예약
  const [myReservation, setMyReservation] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'packages'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  async function handlePickImage() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function toggleTag(tag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  }

  function calcDiscount(price, original) {
    const p = Number(price);
    const o = Number(original);
    if (!p || !o || o <= p) return null;
    return Math.round((1 - p / o) * 100) + '%';
  }

  async function handleSubmit() {
    if (!form.title.trim()) { Alert.alert('입력 오류', '패키지명을 입력해주세요.'); return; }
    if (!form.price.trim() || !form.originalPrice.trim()) { Alert.alert('입력 오류', '가격을 입력해주세요.'); return; }
    if (!form.destination.trim()) { Alert.alert('입력 오류', '여행지를 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      let imageUrl = null;
      if (imageUri) {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        const storageRef = ref(storage, `packages/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }
      const discount = calcDiscount(form.price, form.originalPrice);
      const includesArr = form.includes.split('\n').map(s => s.trim()).filter(Boolean);
      const scheduleArr = form.schedule.split('\n').map(s => s.trim()).filter(Boolean);
      await addDoc(collection(db, 'packages'), {
        uid: user.uid,
        author: userProfile?.nickname || user.displayName || user.email,
        title: form.title.trim(),
        destination: form.destination.trim(),
        duration: form.duration.trim(),
        price: form.price.trim(),
        originalPrice: form.originalPrice.trim(),
        discount: discount || '0%',
        tags: form.tags,
        includes: includesArr,
        schedule: scheduleArr,
        image: imageUrl,
        rating: 0,
        reviews: 0,
        createdAt: serverTimestamp(),
      });
      setAddVisible(false);
      setForm(EMPTY_FORM);
      setImageUri(null);
    } catch {
      Alert.alert('오류', '패키지 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeletePackage(pkg) {
    Alert.alert('삭제 확인', '이 패키지를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'packages', pkg.id));
            setModalVisible(false);
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        }
      }
    ]);
  }

  async function openPackageDetail(pkg) {
    setSelectedPackage(pkg);
    setModalVisible(true);
    setReviewList([]);
    setReviewText('');
    setReviewRating(5);
    setShowReviewForm(false);
    setMyReservation(null);
    setReviewLoading(true);
    try {
      const q = query(collection(db, 'packages', pkg.id, 'reviews'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setReviewList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (user) {
        const rSnap = await getDocs(query(collection(db, 'reservations'), where('uid', '==', user.uid), where('packageId', '==', pkg.id)));
        if (!rSnap.empty) setMyReservation({ id: rSnap.docs[0].id, ...rSnap.docs[0].data() });
      }
    } catch {
      // ignore
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleAddReview() {
    if (!user) { Alert.alert('로그인 필요', '리뷰는 로그인 후 작성할 수 있습니다.'); return; }
    if (!reviewText.trim()) { Alert.alert('입력 오류', '리뷰 내용을 입력해주세요.'); return; }
    setSubmittingReview(true);
    try {
      const existSnap = await getDocs(query(collection(db, 'packages', selectedPackage.id, 'reviews'), where('uid', '==', user.uid)));
      if (!existSnap.empty) { Alert.alert('알림', '이미 리뷰를 작성하셨습니다.'); return; }
      await addDoc(collection(db, 'packages', selectedPackage.id, 'reviews'), {
        uid: user.uid,
        author: userProfile?.nickname || user.email,
        rating: reviewRating,
        text: reviewText.trim(),
        createdAt: serverTimestamp(),
      });
      const newCount = (selectedPackage.reviews ?? 0) + 1;
      const newRating = parseFloat((((selectedPackage.rating ?? 0) * (newCount - 1) + reviewRating) / newCount).toFixed(1));
      await updateDoc(doc(db, 'packages', selectedPackage.id), { reviews: increment(1), rating: newRating });
      setReviewText('');
      setReviewRating(5);
      setShowReviewForm(false);
      const q = query(collection(db, 'packages', selectedPackage.id, 'reviews'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setReviewList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSelectedPackage(prev => ({ ...prev, reviews: newCount, rating: newRating }));
    } catch {
      Alert.alert('오류', '리뷰 등록에 실패했습니다.');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleReserve() {
    if (!user) { Alert.alert('로그인 필요', '예약은 로그인 후 이용할 수 있습니다.'); return; }
    if (myReservation) return;
    Alert.alert(
      '예약 확인',
      `${selectedPackage.title}\n₩${fmt(selectedPackage.price)}/인\n\n예약하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '예약하기',
          onPress: async () => {
            try {
              const newRef = await addDoc(collection(db, 'reservations'), {
                uid: user.uid,
                userNickname: userProfile?.nickname || user.email,
                packageId: selectedPackage.id,
                packageTitle: selectedPackage.title,
                packageImage: selectedPackage.image || null,
                price: selectedPackage.price,
                destination: selectedPackage.destination || '',
                duration: selectedPackage.duration || '',
                status: '예약중',
                createdAt: serverTimestamp(),
              });
              setMyReservation({ id: newRef.id, status: '예약중' });
              Alert.alert('예약 완료', '예약이 완료되었습니다!\n마이 탭에서 확인하실 수 있습니다.');
            } catch {
              Alert.alert('오류', '예약에 실패했습니다.');
            }
          },
        },
      ]
    );
  }

  function handleReportPackage(pkg) {
    if (!user) { Alert.alert('로그인 필요', '신고는 로그인 후 이용할 수 있습니다.'); return; }
    Alert.alert('신고', '이 패키지를 신고하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '신고하기', style: 'destructive', onPress: async () => {
        try {
          const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('targetId', '==', pkg.id)));
          if (!snap.empty) { Alert.alert('알림', '이미 신고한 패키지입니다.'); return; }
          await addDoc(collection(db, 'reports'), {
            uid: user.uid, targetId: pkg.id, targetType: 'package',
            reason: '부적절한 패키지', createdAt: serverTimestamp(),
          });
          Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 처리됩니다.');
        } catch { Alert.alert('오류', '신고에 실패했습니다.'); }
      }},
    ]);
  }

  const fmt = (n) => Number(n).toLocaleString();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>여행 패키지</Text>
          <Text style={styles.headerSub}>특가 할인 패키지 모음</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (!user) { Alert.alert('로그인 필요', '패키지 등록은 로그인 후 이용할 수 있습니다.'); return; }
            setForm(EMPTY_FORM); setImageUri(null); setAddVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>등록</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>🔥</Text>
          <View>
            <Text style={styles.bannerTitle}>이번 주 특가!</Text>
            <Text style={styles.bannerSub}>할인 패키지 모음</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF6B6B" size="large" style={{ marginTop: 60 }} />
        ) : packages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyText}>등록된 패키지가 없습니다.</Text>
            <Text style={styles.emptySubText}>첫 번째 패키지를 등록해보세요!</Text>
          </View>
        ) : (
          packages.map(pkg => (
            <TouchableOpacity key={pkg.id} style={styles.pkgCard} onPress={() => openPackageDetail(pkg)}>
              {pkg.discount && pkg.discount !== '0%' && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{pkg.discount} OFF</Text>
                </View>
              )}
              {pkg.image
                ? <Image source={{ uri: pkg.image }} style={styles.pkgImage} />
                : <View style={[styles.pkgImage, styles.pkgImagePlaceholder]}>
                    <Ionicons name="airplane-outline" size={40} color="#ddd" />
                  </View>
              }
              <View style={styles.pkgBody}>
                <Text style={styles.pkgTitle}>{pkg.title}</Text>
                {pkg.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {pkg.tags.map(tag => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color="#FFE66D" />
                  <Text style={styles.ratingText}>{pkg.rating ?? 0}</Text>
                  <Text style={styles.reviewText}>({pkg.reviews ?? 0}개 리뷰)</Text>
                  {pkg.destination ? <Text style={styles.destText}> · {pkg.destination}{pkg.duration ? ` ${pkg.duration}` : ''}</Text> : null}
                </View>
                <View style={styles.priceRow}>
                  {pkg.originalPrice && Number(pkg.originalPrice) > Number(pkg.price) && (
                    <Text style={styles.originalPrice}>₩ {fmt(pkg.originalPrice)}</Text>
                  )}
                  <Text style={styles.price}>₩ {fmt(pkg.price)}</Text>
                  <Text style={styles.priceUnit}>/인</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 상세 모달 */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        {selectedPackage && (
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <ScrollView>
              {selectedPackage.image
                ? <Image source={{ uri: selectedPackage.image }} style={styles.modalImage} />
                : <View style={[styles.modalImage, styles.pkgImagePlaceholder]}>
                    <Ionicons name="airplane-outline" size={60} color="#ddd" />
                  </View>
              }
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{selectedPackage.title}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FFE66D" />
                  <Text style={styles.ratingText}>{selectedPackage.rating ?? 0}</Text>
                  <Text style={styles.reviewText}>({selectedPackage.reviews ?? 0}개 리뷰)</Text>
                </View>
                <View style={styles.priceBox}>
                  {selectedPackage.originalPrice && Number(selectedPackage.originalPrice) > Number(selectedPackage.price) && (
                    <Text style={styles.modalOriginalPrice}>정가 ₩ {fmt(selectedPackage.originalPrice)}</Text>
                  )}
                  <Text style={styles.modalPrice}>₩ {fmt(selectedPackage.price)} <Text style={styles.perPerson}>/인</Text></Text>
                  {selectedPackage.discount && selectedPackage.discount !== '0%' && (
                    <Text style={styles.discountLabel}>{selectedPackage.discount} 할인!</Text>
                  )}
                </View>

                {selectedPackage.includes?.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>포함 내역</Text>
                    {selectedPackage.includes.map((item, i) => (
                      <View key={i} style={styles.includeRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4ECDC4" />
                        <Text style={styles.includeText}>{item}</Text>
                      </View>
                    ))}
                  </>
                )}

                {selectedPackage.schedule?.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>여행 일정</Text>
                    {selectedPackage.schedule.map((day, i) => (
                      <View key={i} style={styles.scheduleRow}>
                        <View style={styles.dayBadge}><Text style={styles.dayText}>{i + 1}일</Text></View>
                        <Text style={styles.scheduleText}>{day.includes(': ') ? day.split(': ')[1] : day}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* 리뷰 섹션 */}
                <Text style={styles.sectionLabel}>리뷰 ({selectedPackage.reviews ?? 0})</Text>
                {reviewLoading ? (
                  <ActivityIndicator color="#FF6B6B" style={{ marginVertical: 16 }} />
                ) : (
                  <>
                    {reviewList.length === 0 && !showReviewForm && (
                      <Text style={{ color: '#bbb', textAlign: 'center', paddingVertical: 12, fontSize: 13 }}>아직 리뷰가 없습니다.</Text>
                    )}
                    {reviewList.map(review => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <Text style={styles.reviewAuthor}>{review.author}</Text>
                          <View style={{ flexDirection: 'row' }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <Ionicons key={s} name="star" size={11} color={s <= review.rating ? '#FFE66D' : '#ddd'} />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.reviewBody}>{review.text}</Text>
                      </View>
                    ))}
                    {user && selectedPackage.uid !== user.uid && (
                      showReviewForm ? (
                        <View style={styles.reviewForm}>
                          <Text style={styles.reviewFormLabel}>별점</Text>
                          <View style={styles.starSelector}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                                <Ionicons name="star" size={28} color={s <= reviewRating ? '#FFE66D' : '#ddd'} style={{ marginRight: 4 }} />
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TextInput
                            style={styles.reviewInput}
                            placeholder="여행 후기를 남겨주세요..."
                            value={reviewText}
                            onChangeText={setReviewText}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            maxLength={200}
                          />
                          <View style={{ flexDirection: 'row', marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.reviewBtn, { flex: 1, backgroundColor: '#eee', marginRight: 8 }]}
                              onPress={() => setShowReviewForm(false)}
                            >
                              <Text style={{ color: '#888', fontWeight: 'bold' }}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reviewBtn, { flex: 2 }, submittingReview && { opacity: 0.7 }]}
                              onPress={handleAddReview}
                              disabled={submittingReview}
                            >
                              {submittingReview
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={{ color: '#fff', fontWeight: 'bold' }}>등록</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.writeReviewBtn} onPress={() => setShowReviewForm(true)}>
                          <Ionicons name="star-outline" size={16} color="#FF6B6B" />
                          <Text style={styles.writeReviewText}>리뷰 작성하기</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </>
                )}
                <View style={{ height: 20 }} />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {user && selectedPackage.uid !== user.uid && (
                  <TouchableOpacity onPress={() => handleReportPackage(selectedPackage)} style={styles.pkgReportBtn}>
                    <Ionicons name="flag-outline" size={20} color="#ccc" />
                  </TouchableOpacity>
                )}
                <View>
                  <Text style={styles.footerPrice}>₩ {fmt(selectedPackage.price)}</Text>
                  <Text style={styles.footerPriceSub}>1인 기준</Text>
                </View>
              </View>
              {user && selectedPackage.uid === user.uid ? (
                <TouchableOpacity style={[styles.bookBtn, { backgroundColor: '#999' }]} onPress={() => handleDeletePackage(selectedPackage)}>
                  <Text style={styles.bookBtnText}>삭제하기</Text>
                </TouchableOpacity>
              ) : myReservation ? (
                <View style={[styles.bookBtn, { backgroundColor: '#A8E6CF' }]}>
                  <Text style={[styles.bookBtnText, { color: '#1A1A2E' }]}>예약완료 ✓</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.bookBtn} onPress={handleReserve}>
                  <Text style={styles.bookBtnText}>예약하기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* 패키지 등록 모달 */}
      <Modal visible={addVisible} animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.addModalContainer}>
          <View style={styles.addModalHeader}>
            <TouchableOpacity onPress={() => setAddVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.addModalTitle}>패키지 등록</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FF6B6B" /> : <Text style={styles.submitText}>등록</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 이미지 */}
            <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
              {imageUri
                ? <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                : <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={32} color="#ccc" />
                    <Text style={styles.imagePlaceholderText}>대표 사진 추가 (선택)</Text>
                  </View>
              }
            </TouchableOpacity>

            <Text style={styles.labelText}>패키지명</Text>
            <TextInput style={styles.input} placeholder="예: 일본 도쿄 5일 패키지" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.labelText}>여행지</Text>
                <TextInput style={styles.input} placeholder="예: 일본" value={form.destination} onChangeText={v => setForm(f => ({ ...f, destination: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelText}>기간</Text>
                <TextInput style={styles.input} placeholder="예: 5일" value={form.duration} onChangeText={v => setForm(f => ({ ...f, duration: v }))} />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.labelText}>할인가 (원)</Text>
                <TextInput style={styles.input} placeholder="599000" value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelText}>정가 (원)</Text>
                <TextInput style={styles.input} placeholder="899000" value={form.originalPrice} onChangeText={v => setForm(f => ({ ...f, originalPrice: v }))} keyboardType="numeric" />
              </View>
            </View>

            {form.price && form.originalPrice && calcDiscount(form.price, form.originalPrice) && (
              <Text style={styles.discountPreview}>할인율: {calcDiscount(form.price, form.originalPrice)} OFF</Text>
            )}

            <Text style={styles.labelText}>태그</Text>
            <View style={styles.chipWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
                {TAG_OPTIONS.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, form.tags.includes(tag) && styles.chipActive]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.chipText, form.tags.includes(tag) && styles.chipTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.labelText}>포함 내역 (줄바꿈으로 구분)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={'왕복 항공권\n호텔 4박\n공항 픽업'}
              value={form.includes}
              onChangeText={v => setForm(f => ({ ...f, includes: v }))}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.labelText}>여행 일정 (줄바꿈으로 구분)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={'인천 출발 → 도쿄 도착\n아사쿠사 + 신주쿠\n시부야 + 하라주쿠\n자유시간\n귀국'}
              value={form.schedule}
              onChangeText={v => setForm(f => ({ ...f, schedule: v }))}
              multiline
              textAlignVertical="top"
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  headerSub: { fontSize: 13, color: '#999', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B6B', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9E6', margin: 16, borderRadius: 12, padding: 16 },
  bannerEmoji: { fontSize: 30, marginRight: 12 },
  bannerTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A2E' },
  bannerSub: { fontSize: 13, color: '#FF6B6B' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#999' },
  pkgCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden', elevation: 3 },
  discountBadge: { position: 'absolute', top: 12, left: 12, zIndex: 1, backgroundColor: '#FF6B6B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  pkgImage: { width: '100%', height: 180 },
  pkgImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  pkgBody: { padding: 14 },
  pkgTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tag: { backgroundColor: '#E8F8F7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 4 },
  tagText: { fontSize: 11, color: '#4ECDC4' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#333', marginLeft: 4 },
  reviewText: { fontSize: 12, color: '#999', marginLeft: 4 },
  destText: { fontSize: 12, color: '#999' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  originalPrice: { fontSize: 12, color: '#999', textDecorationLine: 'line-through', marginRight: 8 },
  price: { fontSize: 20, fontWeight: 'bold', color: '#FF6B6B' },
  priceUnit: { fontSize: 12, color: '#999', marginLeft: 2 },
  // 상세 모달
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  closeBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 6 },
  modalImage: { width: '100%', height: 260 },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  priceBox: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 14, marginVertical: 14 },
  modalOriginalPrice: { fontSize: 13, color: '#999', textDecorationLine: 'line-through' },
  modalPrice: { fontSize: 28, fontWeight: 'bold', color: '#FF6B6B' },
  perPerson: { fontSize: 14, fontWeight: 'normal', color: '#999' },
  discountLabel: { fontSize: 13, color: '#FF6B6B', fontWeight: 'bold', marginTop: 4 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginTop: 16, marginBottom: 10 },
  includeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  includeText: { fontSize: 14, color: '#444', marginLeft: 8 },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  dayBadge: { backgroundColor: '#1A1A2E', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  dayText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  scheduleText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },
  pkgReportBtn: { padding: 8 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  footerPrice: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  footerPriceSub: { fontSize: 11, color: '#999' },
  bookBtn: { backgroundColor: '#FF6B6B', borderRadius: 12, paddingHorizontal: 30, paddingVertical: 14 },
  bookBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  // 리뷰
  reviewItem: { backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthor: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  reviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  reviewForm: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginTop: 8 },
  reviewFormLabel: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  starSelector: { flexDirection: 'row', marginBottom: 12 },
  reviewInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, fontSize: 13, height: 80, textAlignVertical: 'top' },
  reviewBtn: { borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: '#FF6B6B' },
  writeReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 10, padding: 12, marginTop: 8 },
  writeReviewText: { color: '#FF6B6B', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  // 등록 모달
  addModalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 50 },
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  addModalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A2E' },
  submitText: { fontSize: 15, color: '#FF6B6B', fontWeight: 'bold' },
  imagePickerBtn: { marginBottom: 20 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  imagePlaceholder: { width: '100%', height: 150, backgroundColor: '#F5F5F5', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { color: '#ccc', fontSize: 13, marginTop: 8 },
  labelText: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  rowInputs: { flexDirection: 'row' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  textArea: { height: 120, textAlignVertical: 'top' },
  discountPreview: { fontSize: 13, color: '#FF6B6B', fontWeight: 'bold', marginBottom: 16, marginTop: -8 },
  chipWrapper: { marginBottom: 16 },
  chipContent: { paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  chipActive: { backgroundColor: '#FF6B6B' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
});
