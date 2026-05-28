import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Search, X, Check, Globe } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { COUNTRIES, type Country } from '@/constants/countries';
import AnimatedPressable from '@/components/AnimatedPressable';

interface CountryPickerProps {
  value: string;
  onChange: (country: string) => void;
  placeholder?: string;
  error?: string;
}

export default function CountryPicker({
  value,
  onChange,
  placeholder = 'Select Country',
  error,
}: CountryPickerProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // Delay to allow modal animation to finish, then focus search
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const filtered = useMemo<Country[]>(() => {
    if (!search.trim()) {
      return COUNTRIES;
    }
    const lower = search.toLowerCase();
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(lower)
    );
  }, [search]);

  const handleSelect = (country: Country) => {
    onChange(country.name);
    setVisible(false);
    setSearch('');
  };

  const selectedCountry = COUNTRIES.find(c => c.name === value);

  return (
    <>
      <AnimatedPressable
        onPress={() => setVisible(true)}
        style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}
      >
        <Globe size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <Text style={value ? styles.inputText : styles.placeholder}>
          {value || placeholder}
        </Text>
        <View style={styles.chevron}>
          {selectedCountry ? (
            <Check size={16} color={Colors.success} />
          ) : (
            <Text style={styles.chevronText}>▼</Text>
          )}
        </View>
      </AnimatedPressable>
      {error ? <Text style={styles.errorHint}>{error}</Text> : null}

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Country</Text>
            <Pressable
              onPress={() => {
                setVisible(false);
                setSearch('');
              }}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchWrapper}>
            <Search size={16} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search countries..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={8}
                style={styles.clearSearchBtn}
              >
                <X size={16} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.countryRow,
                  item.name === value && styles.countryRowSelected,
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text
                  style={[
                    styles.countryName,
                    item.name === value && styles.countryNameSelected,
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={styles.countryCode}>{item.code}</Text>
                {item.name === value && (
                  <Check size={16} color={Colors.f1Red} style={styles.checkIcon} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            }
            keyboardShouldPersistTaps="always"
          />
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  placeholder: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 15,
  },
  chevron: {
    paddingLeft: 8,
  },
  chevronText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  errorHint: {
    color: Colors.error,
    fontSize: 12,
    marginTop: -10,
    marginLeft: 4,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  closeBtn: {
    padding: 6,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearSearchBtn: {
    padding: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  countryRowSelected: {
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
  },
  countryName: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  countryNameSelected: {
    color: Colors.f1Red,
    fontWeight: '600' as const,
  },
  countryCode: {
    color: Colors.textMuted,
    fontSize: 13,
    marginRight: 8,
  },
  checkIcon: {
    marginLeft: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
