import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, TextInput, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const POPULAR_CATEGORIES = ['여행팁', '여행스토리'];

export default function HomeScreen({ navigation }) {
  const [bannerRates, setBannerRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [allPosts, setAllPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [allPackages, setAllPackages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Firestore 전체 posts → 최신 팁 + 인기 여행지 동시 계산
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAllPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPostsLoading(false);
    }, () => setPostsLoading(false));
    return unsub;
  }, []);

  // packages 실시간 로드 (검색용)
  useEffect(() => {
    const q = query(collection(db, 'packages'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setAllPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  // 검색 결과 계산
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const posts = allPosts.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.destination?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q)
    ).slice(0, 4);
    const pkgs = allPackages.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.destination?.toLowerCase().includes(q)
    ).slice(0, 4);
    return { posts, pkgs };
  }, [searchQuery, allPosts, allPackages]);

  // 최신 팁 3개
  const recentTips = allPosts.slice(0, 3);

  // 여행팁/여행스토리 게시글 중 좋아요 상위 3개
  const popularPosts = useMemo(() => {
    return allPosts
      .filter(p => POPULAR_CATEGORIES.includes(p.destination))
      .slice()
      .sort((a, b) => (b.likedBy?.length ?? b.likes ?? 0) - (a.likedBy?.length ?? a.likes ?? 0))
      .slice(0, 3);
  }, [allPosts]);

  // 환율 배너
  useEffect(() => {
    fetch('https://api.frankfurter.app/latest?from=KRW&to=USD,EUR,JPY,THB')
      .then(r => r.json())
      .then(data => {
        const r = data.rates;
        setBannerRates({
          jpy: `100엔 = ₩${Math.round(100 / r.JPY).toLocaleString()}`,
          usd: `🇺🇸 $1 = ₩${Math.round(1 / r.USD).toLocaleString()}`,
          eur: `🇪🇺 €1 = ₩${Math.round(1 / r.EUR).toLocaleString()}`,
          thb: `🇹🇭 ฿1 = ₩${(1 / r.THB).toFixed(1)}`,
        });
      })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✈️ 트래블시커</Text>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            placeholder="목적지, 여행 팁 검색..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        {searchFocused && searchResults && (
          <View style={styles.searchDropdown}>
            {searchResults.posts.length === 0 && searchResults.pkgs.length === 0 ? (
              <Text style={styles.searchEmpty}>검색 결과가 없습니다.</Text>
            ) : (
              <>
                {searchResults.posts.length > 0 && (
                  <>
                    <Text style={styles.searchSection}>여행 팁</Text>
                    {searchResults.posts.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.searchItem}
                        onPress={() => { setSearchQuery(''); navigation.navigate('Community'); }}
                      >
                        <Ionicons name="document-text-outline" size={15} color="#4ECDC4" />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                          <Text style={styles.searchItemTitle} numberOfLines={1}>{p.title}</Text>
                          <Text style={styles.searchItemSub}>{p.destination} · {p.author}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {searchResults.pkgs.length > 0 && (
                  <>
                    <Text style={styles.searchSection}>패키지</Text>
                    {searchResults.pkgs.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.searchItem}
                        onPress={() => { setSearchQuery(''); navigation.navigate('Package'); }}
                      >
                        <Ionicons name="airplane-outline" size={15} color="#FF6B6B" />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                          <Text style={styles.searchItemTitle} numberOfLines={1}>{p.title}</Text>
                          <Text style={styles.searchItemSub}>{p.destination} · {p.duration}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* 인기 여행글 */}
      <Text style={styles.sectionTitle}>인기 여행글</Text>
      {postsLoading ? (
        <ActivityIndicator color="#4ECDC4" style={{ marginBottom: 24 }} />
      ) : popularPosts.length === 0 ? (
        <TouchableOpacity style={styles.emptyTipCard} onPress={() => navigation.navigate('Community')}>
          <Text style={styles.emptyTipText}>아직 인기 여행글이 없어요. 여행팁을 공유해보세요! →</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {popularPosts.map(post => (
            <TouchableOpacity
              key={post.id}
              style={styles.destCard}
              onPress={() => navigation.navigate('Community')}
            >
              <Image source={{ uri: post.image || `https://picsum.photos/200/120?random=${post.id}` }} style={styles.destImage} />
              <View style={styles.destInfo}>
                <Text style={styles.destName} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.destTips}>❤️ {post.likedBy?.length ?? post.likes ?? 0} · {post.destination}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 최신 여행 팁 */}
      <Text style={styles.sectionTitle}>최신 여행 팁</Text>
      {postsLoading ? (
        <ActivityIndicator color="#4ECDC4" style={{ marginVertical: 20 }} />
      ) : recentTips.length === 0 ? (
        <TouchableOpacity style={styles.emptyTipCard} onPress={() => navigation.navigate('Community')}>
          <Text style={styles.emptyTipText}>아직 등록된 팁이 없어요. 첫 번째 팁을 공유해보세요! →</Text>
        </TouchableOpacity>
      ) : (
        recentTips.map(tip => (
          <TouchableOpacity key={tip.id} style={styles.tipCard} onPress={() => navigation.navigate('Community')}>
            <Image source={{ uri: tip.avatar || `https://picsum.photos/40/40?random=${tip.id}` }} style={styles.avatar} />
            <View style={styles.tipContent}>
              <View style={styles.tipHeader}>
                <Text style={styles.tipAuthor}>{tip.author}</Text>
                <Text style={styles.tipDestBadge}>{tip.destination}</Text>
              </View>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <View style={styles.tipFooter}>
                <Ionicons name="heart-outline" size={14} color="#FF6B6B" />
                <Text style={styles.tipLikes}> {tip.likes ?? 0}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* 환율 배너 */}
      <TouchableOpacity style={styles.exchangeBanner} onPress={() => navigation.navigate('Community')}>
        <View style={styles.exchangeBannerLeft}>
          <Text style={styles.exchangeBannerLabel}>💱 오늘의 환율</Text>
          {ratesLoading ? (
            <ActivityIndicator color="#4ECDC4" size="small" style={{ marginVertical: 4 }} />
          ) : (
            <Text style={styles.exchangeBannerRate}>{bannerRates ? bannerRates.jpy : '-'}</Text>
          )}
          <Text style={styles.exchangeBannerSub}>환전 꿀팁 커뮤니티 바로가기 →</Text>
        </View>
        {!ratesLoading && bannerRates && (
          <View style={styles.exchangeRateList}>
            <Text style={styles.exchangeRateItem}>{bannerRates.usd}</Text>
            <Text style={styles.exchangeRateItem}>{bannerRates.eur}</Text>
            <Text style={styles.exchangeRateItem}>{bannerRates.thb}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.bannerCard}>
        <Text style={styles.bannerTitle}>🏷️ 오늘의 여행 패키지</Text>
        <Text style={styles.bannerSubtitle}>일본 도쿄 5일 패키지 특가!</Text>
        <Text style={styles.bannerPrice}>₩ 599,000 ~</Text>
        <TouchableOpacity style={styles.bannerBtn} onPress={() => navigation.navigate('Package')}>
          <Text style={styles.bannerBtnText}>지금 보기</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A2E' },
  searchWrapper: { marginHorizontal: 20, marginBottom: 20, zIndex: 100 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#333' },
  searchDropdown: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, elevation: 8, paddingVertical: 8 },
  searchEmpty: { textAlign: 'center', color: '#bbb', fontSize: 13, paddingVertical: 12 },
  searchSection: { fontSize: 11, fontWeight: 'bold', color: '#4ECDC4', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  searchItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  searchItemTitle: { fontSize: 13, color: '#1A1A2E', fontWeight: '500' },
  searchItemSub: { fontSize: 11, color: '#999', marginTop: 1 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A2E', marginHorizontal: 20, marginBottom: 12 },
  horizontalScroll: { paddingLeft: 20, marginBottom: 24 },
  destCard: { width: 160, marginRight: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', elevation: 3 },
  destImage: { width: 160, height: 100 },
  destInfo: { padding: 10 },
  destName: { fontSize: 13, fontWeight: 'bold', color: '#1A1A2E' },
  destTips: { fontSize: 11, color: '#4ECDC4', marginTop: 2 },
  tipCard: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 14, elevation: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  tipContent: { flex: 1, marginLeft: 12 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  tipAuthor: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  tipDestBadge: { fontSize: 10, color: '#fff', backgroundColor: '#4ECDC4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  tipTitle: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  tipFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  tipLikes: { fontSize: 12, color: '#999' },
  emptyTipCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 16, elevation: 2, borderLeftWidth: 3, borderLeftColor: '#4ECDC4' },
  emptyTipText: { fontSize: 13, color: '#4ECDC4', fontWeight: '500' },
  exchangeBanner: { flexDirection: 'row', backgroundColor: '#E8FBF9', marginHorizontal: 20, marginBottom: 20, borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: '#4ECDC4' },
  exchangeBannerLeft: { flex: 1 },
  exchangeBannerLabel: { fontSize: 11, color: '#4ECDC4', fontWeight: 'bold', marginBottom: 4 },
  exchangeBannerRate: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 4 },
  exchangeBannerSub: { fontSize: 11, color: '#4ECDC4' },
  exchangeRateList: { justifyContent: 'center', gap: 4 },
  exchangeRateItem: { fontSize: 12, color: '#555' },
  bannerCard: { margin: 20, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20 },
  bannerTitle: { fontSize: 13, color: '#4ECDC4', marginBottom: 6 },
  bannerSubtitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  bannerPrice: { fontSize: 22, fontWeight: 'bold', color: '#FFE66D', marginBottom: 14 },
  bannerBtn: { backgroundColor: '#4ECDC4', borderRadius: 8, padding: 10, alignItems: 'center' },
  bannerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
