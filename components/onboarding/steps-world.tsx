import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CATEGORIES, CATEGORY_BY_ID, WORLD_REACTIONS, levelReaction, type CategoryId } from './content';
import { Chip, Field, Heading, LevelTile, Reveal, WorldTile, gridCell, gridStyle } from './controls';
import { disciplineId, worldDisciplines } from './draft';
import { useOnboardingReed } from './reed-context';
import { toggle, type StepProps } from './step-props';

export function WorldsStep({ draft, update }: StepProps) {
  const { say } = useOnboardingReed();
  return (
    <>
      <Heading title="What do you do with your body?" />
      <View style={gridStyle}>
        {CATEGORIES.map((category, index) => {
          const selected = draft.categories.includes(category.id);
          return (
            <Reveal delay={350 + index * 35} key={category.id} style={gridCell}>
              <WorldTile
                icon={category.icon}
                label={category.label}
                onPress={() => {
                  if (!selected) say(WORLD_REACTIONS[category.id], 1800);
                  update({ categories: toggle(draft.categories, category.id) });
                }}
                selected={selected}
                tagline={category.tagline}
              />
            </Reveal>
          );
        })}
      </View>
    </>
  );
}

/** One screen per world: tap what you do, tap again to go deeper. */
export function WorldStep({ category, draft, update }: StepProps & { category: CategoryId }) {
  const { reed, say } = useOnboardingReed();
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const world = CATEGORY_BY_ID[category];
  const disciplines = worldDisciplines(draft, category);

  const setLevel = (label: string, level: number) => {
    const id = disciplineId(category, label);
    const levels = { ...draft.levels };
    if (level === 0) delete levels[id];
    else levels[id] = level;
    update({ levels });
    if (level > 0) {
      say(levelReaction(label, level), 2200);
      if (level === 2) reed?.react('happy', 1400);
      if (level === 3) reed?.react('proud', 1800);
      if (level === 4) reed?.react('excited', 2000);
      if (level === 1) reed?.react('happy', 1200);
    }
  };

  const addCustom = () => {
    const label = custom.trim();
    setAdding(false);
    setCustom('');
    if (!label) return;
    const existing = disciplines.find(entry => entry.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      setLevel(existing.label, Math.max(1, draft.levels[disciplineId(category, existing.label)] ?? 0));
      return;
    }
    update({
      customs: { ...draft.customs, [category]: [...(draft.customs[category] ?? []), label] },
      levels: { ...draft.levels, [disciplineId(category, label)]: 1 },
    });
    say(levelReaction(label, 1), 2200);
  };

  return (
    <>
      <Heading sub="Tap what you do. Tap again to go deeper." title={world.prompt} />
      <View style={gridStyle}>
        {disciplines.map((entry, index) => (
          <Reveal delay={350 + index * 30} key={entry.label} style={gridCell}>
            <LevelTile hint={entry.hint} label={entry.label} level={draft.levels[disciplineId(category, entry.label)] ?? 0} onChange={level => setLevel(entry.label, level)} />
          </Reveal>
        ))}
      </View>
      <Reveal delay={350 + disciplines.length * 30}>
        {adding ? (
          <Field autoFocus maxLength={30} onBlur={addCustom} onChangeText={setCustom} onSubmitEditing={addCustom} placeholder="What else do you do?" returnKeyType="done" value={custom} />
        ) : (
          <View style={styles.addRow}>
            <Chip label="+ Add your own" onPress={() => setAdding(true)} selected={false} />
          </View>
        )}
      </Reveal>
    </>
  );
}

const styles = StyleSheet.create({
  addRow: {
    alignItems: 'center',
  },
});
