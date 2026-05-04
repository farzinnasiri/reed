export const reedTrainingKnowledgeToolNames = [
  'summarize_training_window',
  'get_bodyweight_trend',
  'compare_exercise_performance',
] as const;

export type ReedTrainingKnowledgeToolName = (typeof reedTrainingKnowledgeToolNames)[number];

export type ReedTrainingKnowledgeToolDescriptor = {
  description: string;
  name: ReedTrainingKnowledgeToolName;
};

export const reedTrainingKnowledgeTools: ReedTrainingKnowledgeToolDescriptor[] = [
  {
    description: 'Summarize what training the user performed in a bounded time window.',
    name: 'summarize_training_window',
  },
  {
    description: 'Return bodyweight trend points and delta for a bounded time window.',
    name: 'get_bodyweight_trend',
  },
  {
    description: 'Compare one exercise performance snapshot at two timestamps.',
    name: 'compare_exercise_performance',
  },
];
