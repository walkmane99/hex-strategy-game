import React from 'react';
import {
  View,
  Text,
  Modal as RNModal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { C, MONO, DISPLAY } from '@/constants/theme';

interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

export default function Modal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelLabel = 'キャンセル',
  confirmLabel = '確定',
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.confirmBtn]} onPress={onConfirm}>
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '82%',
    backgroundColor: C.bg1,
    borderWidth: 1,
    borderColor: C.amber,
    padding: 16,
    gap: 12,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 8,
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: C.amber,
    letterSpacing: 0.8,
  },
  message: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.ink2,
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtn: {
    borderColor: C.line,
    backgroundColor: C.bg0,
  },
  confirmBtn: {
    borderColor: C.amber,
    backgroundColor: '#1a0d00',
  },
  cancelLabel: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.ink2,
  },
  confirmLabel: {
    fontFamily: DISPLAY,
    fontSize: 12,
    fontWeight: '700',
    color: C.amber,
  },
});
