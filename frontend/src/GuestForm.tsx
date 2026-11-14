import { Button, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { type FormEvent, useState } from 'react';

import { createMeeting, type Meeting } from './generated/index.ts';
import { type Field, rejectedField } from './rejectedField.ts';

/** What the guest typed. It outlives the form, so going back to the slots keeps it. */
export type Guest = { name: string; email: string; topic: string };

type Errors = { name?: string; email?: string; topic?: string };

// Only a rough check: the server has the last word on the email.
const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const topicLimit = 500;

/** Counts characters the way the contract does, so an emoji is one character rather than two. */
const topicLength = (topic: string) => [...topic].length;

/** Checks the trimmed values the way the contract does, so most mistakes never reach the server. */
function validate({ name, email, topic }: Guest): Errors {
  const errors: Errors = {};
  if (!name) errors.name = 'Введите имя';
  else if (name.length > 100) errors.name = 'Имя длиннее 100 символов';
  if (!email) errors.email = 'Введите email';
  else if (email.length > 254) errors.email = 'Email длиннее 254 символов';
  else if (!emailShape.test(email)) errors.email = 'Неверный email';
  if (topicLength(topic) > topicLimit) errors.topic = 'Тема длиннее 500 символов';
  return errors;
}

/** What to show under the fields the server rejects. */
const serverErrors: Partial<Record<Field, Errors>> = {
  guestName: { name: 'Проверьте имя' },
  guestEmail: { email: 'Неверный email' },
  topic: { topic: 'Тема длиннее 500 символов' },
};

type Props = {
  meetingTypeId: string;
  /** The start of the chosen slot. */
  start: string;
  guest: Guest;
  onGuestChange: (guest: Guest) => void;
  onCreated: (meeting: Meeting) => void;
  /** The server no longer knows the meeting type. */
  onNotFound: () => void;
  /**
   * The server refused the slot: someone has taken it or it has left the booking window.
   * `notice` tells the guest so above the slots.
   */
  onSlotGone: (notice: string) => void;
  /** Goes back to the slots of the day. */
  onOtherTime: () => void;
};

/** The guest's name and email for the chosen slot, in place of the slots. */
function GuestForm({
  meetingTypeId,
  start,
  guest,
  onGuestChange,
  onCreated,
  onNotFound,
  onSlotGone,
  onOtherTime,
}: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit({ name, email, topic }: Guest) {
    setSubmitting(true);
    const { data, error, response } = await createMeeting({
      path: { meetingTypeId },
      body: { start, guestName: name, guestEmail: email, topic },
    });
    setSubmitting(false);
    if (data) return onCreated(data);
    if (response?.status === 404) return onNotFound();
    if (response?.status === 409) return onSlotGone('Это время уже заняли. Выберите другое.');

    const field = rejectedField(error, response);
    if (field === 'start') return onSlotGone('Это время больше недоступно. Выберите другое.');
    const fieldError = field && serverErrors[field];
    if (fieldError) setErrors(fieldError);
    else setFailed(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = {
      name: guest.name.trim(),
      email: guest.email.trim(),
      topic: guest.topic.trim(),
    };
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    setFailed(false);
    if (Object.keys(fieldErrors).length > 0) return;
    void submit(values);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <Stack gap="md">
        {failed && (
          <Text c="red" size="sm">
            Не удалось записаться. Попробуйте ещё раз.
          </Text>
        )}
        <TextInput
          label="Имя"
          required
          autoComplete="name"
          value={guest.name}
          onChange={(event) => onGuestChange({ ...guest, name: event.currentTarget.value })}
          error={errors.name}
        />
        <TextInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={guest.email}
          onChange={(event) => onGuestChange({ ...guest, email: event.currentTarget.value })}
          error={errors.email}
        />
        <Stack gap={4}>
          <Textarea
            label="О чём хотите поговорить?"
            description="Коротко опишите тему, необязательно"
            minRows={3}
            value={guest.topic}
            onChange={(event) => onGuestChange({ ...guest, topic: event.currentTarget.value })}
            error={errors.topic}
          />
          <Text c="dimmed" size="xs" ta="right">
            {topicLength(guest.topic)} / {topicLimit}
          </Text>
        </Stack>
        <Button type="submit" fullWidth loading={submitting}>
          Записаться
        </Button>
        <Button variant="subtle" fullWidth onClick={onOtherTime}>
          Другое время
        </Button>
      </Stack>
    </form>
  );
}

export default GuestForm;
