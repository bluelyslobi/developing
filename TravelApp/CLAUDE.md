@AGENTS.md

# 트래블시커 (TravelApp)

여행 커뮤니티 + 중고거래 + 패키지 예약 앱. React Native + Expo v56.

## 실행 커맨드

```powershell
# 웹 (가장 빠른 테스트)
cd C:\Users\User.DESKTOP-BLBKBC2\Projects\TravelApp
npx expo start --web

# 안드로이드 에뮬레이터 (Pixel_8 AVD)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -ArgumentList "-avd Pixel_8"
npx expo start --android

# ADB 유틸
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices          # 연결 확인
& $adb reverse tcp:8081 tcp:8081  # 포트 포워딩
```

## 파일 구조

```
App.js                  # 루트: AuthProvider + BottomTabNavigator
index.js                # Expo 진입점
context/
  AuthContext.js        # Firebase Auth + Firestore 유저 프로필 (useAuth hook)
services/
  firebase.js           # Firebase 초기화 (auth, db, storage 익스포트)
  uploadImage.js        # expo-image-picker + Firebase Storage 업로드
screens/
  HomeScreen.js         # 홈: 환율 배너 + 여행지 카드 + 최신 게시글
  CommunityScreen.js    # 커뮤니티: 게시글 CRUD + 이미지 업로드 + 좋아요(중복방지) + 삭제
  MarketScreen.js       # 중고거래: 상품 목록 + 판매완료처리 + 삭제 + ChatScreen 모달
  PackageScreen.js      # 패키지: 여행 상품 목록 + 삭제
  ProfileScreen.js      # 마이: 로그인/회원가입 + 판매내역/구매내역/찜한팁/프로필수정
  ChatScreen.js         # 채팅 모달 — MarketScreen에서 <ChatScreen visible={} onClose={} product={} currentUser={} />로 렌더링. 별도 탭 없음.
```

## 네비게이션 탭 순서

`Home → Community → Market → Package → Profile`
탭 레이블: `홈 / 커뮤니티 / 중고거래 / 패키지 / 마이`
이동: `navigation.navigate('Community')` 등으로 탭 이름 사용

## 브랜드 컬러

| 역할 | 코드 |
|------|------|
| 주 강조색 (teal) | `#4ECDC4` |
| 배경/텍스트 (dark navy) | `#1A1A2E` |
| 가격 강조 (yellow) | `#FFE66D` |
| 에러/좋아요 (red) | `#FF6B6B` |
| 카드 배경 | `#fff` |
| 전체 배경 | `#F8F9FA` |

## Firebase 구성

- **프로젝트**: `travelshare-b6659` (내부 식별자 — 앱 표시명은 "트래블시커"로 변경됐지만 Firebase 프로젝트 ID는 생성 후 변경 불가라 그대로 유지)
- **크레덴셜**: `services/firebase.js`에 하드코딩 (`.env` 없음)
- **Auth**: 이메일/비밀번호 (`initializeAuth` + AsyncStorage 영속성)
- **Firestore**: `posts` 컬렉션 (커뮤니티 게시글), `users` 컬렉션 (유저 프로필)
- **Storage**: 게시글 이미지 업로드 (`services/uploadImage.js`)

`useAuth()` hook으로 `{ user, userProfile, setUserProfile, loading, signUp, login, logout }` 접근.

## 주요 의존성

```json
"expo": "~56.0.12"
"react": "19.2.3"
"react-native": "0.85.3"
"firebase": "^12.15.0"
"@react-navigation/bottom-tabs": "^7.18.2"
"expo-image-picker": "~56.0.18"
"@react-native-async-storage/async-storage": "2.2.0"
```

## Firestore 스키마

**`posts` 컬렉션** (커뮤니티 게시글):
```js
{
  uid: string,           // 작성자 Firebase UID
  author: string,        // 표시 닉네임
  avatar: string,        // 프로필 이미지 URL
  destination: string,   // '여행팁'|'여행스토리'|'환전정보' (필터 전용 '전체' 포함, 커뮤니티 카테고리)
  title: string,
  content: string,
  image: string | null,  // Storage 다운로드 URL 또는 null
  likes: number,
  likedBy: string[],     // 좋아요한 uid 배열 (중복방지용)
  comments: number,
  createdAt: Timestamp,  // serverTimestamp()
}
```

**`users` 컬렉션** (유저 프로필):
```js
{
  uid: string,
  email: string,
  nickname: string,
  createdAt: Timestamp,
  postCount: number,     // 글 작성 시 +1, 삭제 시 -1
  likeCount: number,
  followCount: number,
}
```

**`products` 컬렉션** (중고거래 상품):
```js
{
  uid: string,           // 판매자 Firebase UID
  author: string,
  title: string,
  price: number,
  category: string,
  condition: string,
  location: string,
  description: string,
  image: string | null,
  status: '판매중' | '판매완료',
  createdAt: Timestamp,
}
```

**`packages` 컬렉션** (여행 패키지):
```js
{
  uid: string,
  author: string,
  title: string,
  destination: string,
  duration: string,
  price: number,
  originalPrice: number,
  discount: number,
  tags: string[],
  includes: string[],
  schedule: string[],
  image: string | null,
  rating: number,
  reviews: number,
  createdAt: Timestamp,
}
```

**`chats` 컬렉션** (채팅방):
```js
// chatId = [buyerUid, sellerUid].sort().join('_') + '_' + productId
// participants[0] = buyer, participants[1] = seller
{
  participants: string[],
  productId: string,
  productTitle: string,
  lastMessage: string,
  lastMessageAt: Timestamp,
}
// 서브컬렉션: chats/{chatId}/messages/{id}
{ uid: string, text: string, createdAt: Timestamp }
```

## Firebase 코드 패턴

**Firestore 읽기 (실시간):**
```js
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
const unsubscribe = onSnapshot(q, snapshot => {
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});
return unsubscribe; // useEffect cleanup
```

**Firestore 쓰기:**
```js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
await addDoc(collection(db, 'posts'), { ...fields, createdAt: serverTimestamp() });
```

**이미지 업로드 (Storage):**
```js
import { pickAndUploadImage } from '../services/uploadImage';
const url = await pickAndUploadImage(`posts/${user.uid}_${Date.now()}`);
// url: Firebase Storage 다운로드 URL (string), 실패/취소 시 null
```

**환율 API:** `https://api.frankfurter.app/latest?from=KRW&to=USD,EUR,JPY,THB` (외부 API, 백엔드 없음)

## 개발 규칙

- Expo v56 문서 기준: https://docs.expo.dev/versions/v56.0.0/
- StyleSheet는 각 파일 하단에 위치
- 이미지 placeholder: `https://picsum.photos/{width}/{height}?random={seed}`
- 상태 관리: `useState` 로컬 + Firestore `onSnapshot` 실시간 리스너
- 컴포넌트 없음 (`components/` 폴더는 비어있음) — 화면별 파일에 인라인 작성
- 에러 처리: `try/catch` + `Alert.alert()`, 네트워크 오류는 빈 상태 유지 (무시)
