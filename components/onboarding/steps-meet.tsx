import { StyleSheet, View } from 'react-native';
import { Field, Heading, Reveal, Say } from './controls';
import { useBeforeNext } from './reed-context';
import type { StepProps } from './step-props';

export function HelloStep({ draft, next, update }: StepProps) {
  return (
    <View style={styles.hello}>
      <View style={styles.centered}>
        <Say delay={200} text="Hey. I'm Reed." variant="display" />
        <Say delay={900} text="I'll be in your corner. First, what should I call you?" tone="secondary" variant="voice" />
      </View>
      <Reveal delay={1700}>
        <Field
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={40}
          onChangeText={name => update({ name })}
          onSubmitEditing={() => draft.name.trim() && next()}
          placeholder="Your name"
          returnKeyType="next"
          style={styles.nameInput}
          textContentType="givenName"
          value={draft.name}
        />
      </Reveal>
    </View>
  );
}

/** The personal questions start here, so this is where Reed says what it does with them. Formal terms come later. */
export function ConsentStep({ update }: StepProps) {
  useBeforeNext(() => update({ consent: true }));
  return (
    <Heading
      sub="Next I'll ask about your body, so I can coach it properly. It stays between us, and you can change or delete it any time."
      title="Now the personal part."
    />
  );
}

const styles = StyleSheet.create({
  hello: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 28,
  },
  centered: {
    gap: 10,
  },
  nameInput: {
    fontSize: 20,
    minHeight: 60,
    textAlign: 'center',
  },
});
