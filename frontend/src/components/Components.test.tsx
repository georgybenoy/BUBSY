import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressRing } from './ProgressRing';
import { StepIndicator } from './StepIndicator';
import { Dialog } from './Dialog';
import { StatusBadge } from './StatusBadge';

describe('Shared UI Primitives', () => {
  describe('Button', () => {
    it('renders with kiosk size enforcing at least 64px min-height touch target', () => {
      render(
        <Button size="kiosk" variant="primary">
          LET'S WASH!
        </Button>,
      );
      const btn = screen.getByRole('button', { name: "LET'S WASH!" });
      expect(btn).toBeInTheDocument();
      expect(btn.style.minHeight).toBe('64px');
      expect(btn.style.minWidth).toBe('64px');
    });

    it('renders loading spinner and disables click', () => {
      const handleClick = vi.fn();
      render(
        <Button loading onClick={handleClick}>
          Submit
        </Button>,
      );
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders left and right icons properly', () => {
      render(
        <Button icon={<span data-testid="test-icon">★</span>} iconPosition="left">
          Star
        </Button>,
      );
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders with kiosk styling and padding', () => {
      render(
        <Card variant="kiosk" padding="kiosk">
          <div>Card Content</div>
        </Card>,
      );
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('handles interactive click events', () => {
      const handleClick = vi.fn();
      render(
        <Card interactive onClick={handleClick}>
          Interactive Card
        </Card>,
      );
      fireEvent.click(screen.getByText('Interactive Card'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ProgressRing', () => {
    it('renders accessible progressbar with clamped aria values', () => {
      render(<ProgressRing progress={0.75} label="75%" sublabel="Step 2 of 6" />);
      const ring = screen.getByRole('progressbar');
      expect(ring).toBeInTheDocument();
      expect(ring).toHaveAttribute('aria-valuenow', '75');
      expect(ring).toHaveAttribute('aria-valuemin', '0');
      expect(ring).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
    });
  });

  describe('StepIndicator', () => {
    it('renders child-friendly step markers without relying on color alone', () => {
      const steps = [
        { code: 'STEP_1', title: 'Palms' },
        { code: 'STEP_2', title: 'Backs' },
        { code: 'STEP_3', title: 'Between' },
      ];
      render(<StepIndicator steps={steps} currentIndex={1} completedIndices={[0]} />);
      expect(screen.getByRole('navigation', { name: 'Handwashing Steps' })).toBeInTheDocument();
      // Step 1 completed shows checkmark with aria-label
      expect(screen.getByLabelText('Completed')).toBeInTheDocument();
      // Step 2 is active
      expect(screen.getByText('2')).toBeInTheDocument();
      // Step 3 is upcoming
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Dialog', () => {
    it('renders with role="dialog" and aria-modal="true" when open', () => {
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Help Modal" description="How to scan">
          <div>Modal Body</div>
        </Dialog>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Help Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Body')).toBeInTheDocument();

      // Close button
      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key press', () => {
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Escape Test">
          <div>Press Esc</div>
        </Dialog>,
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <Dialog isOpen={false} onClose={() => {}} title="Hidden">
          <div>Hidden Content</div>
        </Dialog>,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('StatusBadge', () => {
    it('renders status text alongside an icon', () => {
      render(<StatusBadge status="success" label="Camera Scanning Active" />);
      expect(screen.getByText('Camera Scanning Active')).toBeInTheDocument();
    });
  });
});
