import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, doc, setDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';

function getChatId(uid1, uid2, productId) {
  return [uid1, uid2].sort().join('_') + '_' + productId;
}

export default function ChatScreen({ visible, onClose, product, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  const chatId = product && currentUser
    ? getChatId(currentUser.uid, product.uid, product.id)
    : null;

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error('채팅 메시지 구독 실패:', error);
      setLoading(false);
    });
    return unsub;
  }, [chatId]);

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !chatId) return;
    setText('');
    // 채팅방 메타 정보 저장 (처음 메시지일 때 생성)
    await setDoc(doc(db, 'chats', chatId), {
      participants: [currentUser.uid, product.uid],
      productId: product.id,
      productTitle: product.title,
      lastMessage: trimmed,
      lastMessageAt: serverTimestamp(),
    }, { merge: true });
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      uid: currentUser.uid,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  }

  if (!product || !currentUser) return null;

  const isMine = (msg) => msg.uid === currentUser.uid;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
            <Text style={styles.headerSub}>{product.author || product.seller}과 채팅 중</Text>
          </View>
        </View>

        {/* 메시지 목록 */}
        {loading ? (
          <ActivityIndicator color="#4ECDC4" size="large" style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>첫 메시지를 보내보세요 👋</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.msgRow, isMine(item) && styles.msgRowMine]}>
                <View style={[styles.bubble, isMine(item) ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isMine(item) && styles.bubbleTextMine]}>{item.text}</Text>
                </View>
              </View>
            )}
          />
        )}

        {/* 입력창 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A2E' },
  headerSub: { fontSize: 12, color: '#999', marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyChat: { flex: 1, alignItems: 'center', marginTop: 80 },
  emptyChatText: { color: '#aaa', fontSize: 14 },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#4ECDC4', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1 },
  bubbleText: { fontSize: 14, color: '#333', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  input: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, marginRight: 8 },
  sendBtn: { backgroundColor: '#4ECDC4', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
