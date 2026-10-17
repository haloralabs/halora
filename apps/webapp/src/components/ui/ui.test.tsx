import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { fireEvent, render, screen } from '@/test/render';
import { Button } from './button';
import { Field } from './field';
import { HaloMeter } from './halo-meter';
import { Input } from './input';
import { Switch } from './switch';
import { Tabs } from './tabs';

describe('Button', () => {
  test('is disabled and busy while loading', () => {
    const onClick = mock(() => {});
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('HaloMeter', () => {
  test('exposes an accessible meter with clamped value and state', () => {
    render(<HaloMeter value={1.4} label="Daily limit used" valueText="30 of 25 USDC" />);
    const meter = screen.getByRole('meter', { name: 'Daily limit used' });
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(meter.getAttribute('aria-valuetext')).toBe('30 of 25 USDC');
    expect(meter.getAttribute('data-state')).toBe('full');
  });

  test('switches to the high state past 75 percent', () => {
    render(<HaloMeter value={0.8} label="Used" valueText="80%" />);
    expect(screen.getByRole('meter').getAttribute('data-state')).toBe('high');
  });
});

describe('Field', () => {
  test('wires the label, hint and error to the control', () => {
    render(
      <Field label="Daily limit" hint="Per UTC day" error="Too low">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Daily limit');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy.split(' ').at(-1)!)?.textContent).toBe('Too low');
  });
});

describe('Switch', () => {
  test('toggles via role="switch"', () => {
    const onChange = mock((_v: boolean) => {});
    render(<Switch label="Paused" checked={false} onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Paused' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Tabs', () => {
  function Harness() {
    const [v, setV] = useState('a');
    return (
      <Tabs
        label="Demo"
        value={v}
        onValueChange={setV}
        items={[
          { id: 'a', label: 'First', content: <p>Alpha</p> },
          { id: 'b', label: 'Second', content: <p>Beta</p> },
        ]}
      />
    );
  }
  test('supports arrow-key navigation', () => {
    render(<Harness />);
    expect(screen.getByText('Alpha')).toBeDefined();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'First' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Beta')).toBeDefined();
  });
});
