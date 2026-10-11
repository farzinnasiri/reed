import { createElement, useRef, useState, type InputHTMLAttributes } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useHapticPreference } from '@/design/haptic-feedback';
import { useReedTheme } from '@/design/provider';
import { isIPhoneSwitchAvailable } from '@/design/haptics-driver.web';
import * as haptics from '@/design/haptics';
import type { HapticPressableProps } from './haptic-pressable';

/** The input is the actual hit target, never a hidden element clicked by JavaScript. */
export function HapticPressable({ feedback = true, hapticValue, systemSwitch = true, ...props }: HapticPressableProps) {
  const { theme } = useReedTheme();
  const [focused, setFocused] = useState(false);
  const { enabled, ready } = useHapticPreference();
  const [pressed, setPressed] = useState(false);
  const [usesInput, setUsesInput] = useState(feedback !== false);
  // Once enhanced, keep the same target when selection disables its tick; quiet buttons stay Pressables.
  if (!usesInput && feedback !== false) setUsesInput(true);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  // RN Web does not map accessibilityState; carry state explicitly to the DOM.
  const aria = {
    'aria-checked': props['aria-checked'] ?? (props.accessibilityRole === 'switch' || props.accessibilityRole === 'checkbox' || props.accessibilityRole === 'radio'
      ? hapticValue ?? props.accessibilityState?.checked : undefined),
    'aria-pressed': props['aria-pressed'] ?? (props.accessibilityRole === 'button' ? props.accessibilityState?.selected : undefined),
    'aria-selected': props['aria-selected'] ?? (props.accessibilityRole === 'tab' ? props.accessibilityState?.selected : undefined),
    'aria-disabled': Boolean(props.disabled || props.accessibilityState?.disabled) || undefined,
    'aria-busy': props.accessibilityState?.busy,
    'aria-expanded': props['aria-expanded'] ?? props.accessibilityState?.expanded,
  };
  if (!systemSwitch || !usesInput || !isIPhoneSwitchAvailable() || props.onLongPress || (props.accessibilityRole && !['button', 'checkbox', 'switch'].includes(props.accessibilityRole))) {
    return <Pressable {...props} {...aria} onPress={event => {
      if (feedback === true) {
        if (hapticValue === undefined) haptics.selection();
        else haptics.toggle(!hapticValue);
      }
      props.onPress?.(event);
    }} />;
  }
  const state = { pressed, hovered: false };
  const style = typeof props.style === 'function' ? props.style(state) : props.style;
  const children = typeof props.children === 'function' ? props.children(state) : props.children;
  const checked = hapticValue ?? props.accessibilityState?.checked === true;
  const inputProps: InputHTMLAttributes<HTMLInputElement> & { switch?: string } = {
    type: 'checkbox', switch: feedback && ready && enabled && !props.disabled ? '' : undefined, checked, disabled: Boolean(props.disabled),
    role: (props.accessibilityRole as 'button' | 'checkbox' | 'switch' | undefined) ?? 'button',
    'aria-label': props.accessibilityLabel,
    'aria-description': props.accessibilityHint,
    ...aria,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: props.disabled ? 'default' : 'pointer', touchAction: 'pan-y' },
    onChange: () => {},
    onPointerDown: event => {
      start.current = { x: event.clientX, y: event.clientY }; dragged.current = false;
      setPressed(true); props.onPressIn?.(event as unknown as GestureResponderEvent);
    },
    onPointerMove: event => {
      if (!dragged.current && start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) {
        dragged.current = true; setPressed(false); props.onPressOut?.(event as unknown as GestureResponderEvent);
      }
    },
    onPointerUp: event => { setPressed(false); props.onPressOut?.(event as unknown as GestureResponderEvent); },
    onPointerCancel: event => { dragged.current = true; setPressed(false); props.onPressOut?.(event as unknown as GestureResponderEvent); },
    onClick: event => {
      event.stopPropagation();
      if (dragged.current || props.disabled) { event.preventDefault(); return; }
      props.onPress?.(event as unknown as GestureResponderEvent);
    },
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') { dragged.current = false; start.current = null; }
      if (event.key === 'Enter' && !props.disabled) {
        event.preventDefault(); props.onPress?.(event as unknown as GestureResponderEvent);
      }
    },
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); setPressed(false); },

  };
  // Keep the input mounted when a choice becomes selected or feedback is disabled, preserving focus.
  // One accessible target: keep the visual content inert, with the original role/name on input.
  return <View onLayout={props.onLayout} testID={props.testID} style={[style, { position: 'relative' }, focused ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: String(theme.colors.accent) } : null]}>
    {createElement('div', { 'aria-hidden': true, style: { display: 'contents', pointerEvents: 'none' } }, children)}
    <input {...inputProps} />
  </View>;
}
