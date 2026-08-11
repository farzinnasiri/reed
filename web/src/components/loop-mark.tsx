type LoopMarkProps = {
  expression?: 'idle' | 'listening' | 'thinking';
  size?: 'small' | 'medium' | 'hero';
};

export function LoopMark({ expression = 'idle', size = 'medium' }: LoopMarkProps) {
  return (
    <span className={`loop-mark loop-mark-${size}`} aria-hidden="true">
      <span className="loop-face">
        <span className={`loop-glyph loop-glyph-${expression}`}>
          <i /><i /><i />
        </span>
      </span>
    </span>
  );
}
