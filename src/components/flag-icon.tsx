import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type FlagCode = 'US' | 'FR' | 'DE' | 'IT' | 'PT';

type FlagIconProps = {
  code: FlagCode;
  size?: number;
};

// Bandera renderizada con formas SVG simples (evita depender de emoji, que no se ve igual en todas las plataformas).
export function FlagIcon({ code, size = 32 }: FlagIconProps) {
  const width = size;
  const height = (size * 3) / 4;

  return (
    <View style={[styles.wrapper, { width, height, borderRadius: size * 0.15 }]}>
      <Svg width={width} height={height} viewBox="0 0 32 24">
        {code === 'US' && <UnitedStatesFlag />}
        {code === 'FR' && <FranceFlag />}
        {code === 'DE' && <GermanyFlag />}
        {code === 'IT' && <ItalyFlag />}
        {code === 'PT' && <PortugalFlag />}
      </Svg>
    </View>
  );
}

function UnitedStatesFlag() {
  const stripeHeight = 24 / 7;
  const stripes = Array.from({ length: 7 }, (_, i) => (
    <Rect
      key={i}
      x={0}
      y={i * stripeHeight}
      width={32}
      height={stripeHeight}
      fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'}
    />
  ));
  const stars = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) => (
      <Circle
        key={`${row}-${col}`}
        cx={2 + col * 3.5}
        cy={1.3 + row * 2}
        r={0.6}
        fill="#FFFFFF"
      />
    ))
  );
  return (
    <>
      {stripes}
      <Rect x={0} y={0} width={14} height={24 * (4 / 7)} fill="#3C3B6E" />
      {stars}
    </>
  );
}

function FranceFlag() {
  return (
    <>
      <Rect x={0} y={0} width={32 / 3} height={24} fill="#0055A4" />
      <Rect x={32 / 3} y={0} width={32 / 3} height={24} fill="#FFFFFF" />
      <Rect x={(32 / 3) * 2} y={0} width={32 / 3} height={24} fill="#EF4135" />
    </>
  );
}

function GermanyFlag() {
  return (
    <>
      <Rect x={0} y={0} width={32} height={8} fill="#000000" />
      <Rect x={0} y={8} width={32} height={8} fill="#DD0000" />
      <Rect x={0} y={16} width={32} height={8} fill="#FFCE00" />
    </>
  );
}

function ItalyFlag() {
  return (
    <>
      <Rect x={0} y={0} width={32 / 3} height={24} fill="#009246" />
      <Rect x={32 / 3} y={0} width={32 / 3} height={24} fill="#FFFFFF" />
      <Rect x={(32 / 3) * 2} y={0} width={32 / 3} height={24} fill="#CE2B37" />
    </>
  );
}

function PortugalFlag() {
  return (
    <>
      <Rect x={0} y={0} width={32 * 0.4} height={24} fill="#046A38" />
      <Rect x={32 * 0.4} y={0} width={32 * 0.6} height={24} fill="#DA291C" />
      <Circle cx={32 * 0.4} cy={12} r={5} fill="#FFCE00" />
      <Path
        d="M 12.8 12 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0"
        fill="#046A38"
        opacity={0.85}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E6EB',
  },
});
