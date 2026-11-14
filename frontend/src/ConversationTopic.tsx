import { Text, type TextProps } from '@mantine/core';

type Props = { topic: string; mt?: TextProps['mt'] };

function ConversationTopic({ topic, mt }: Props) {
  if (!topic) return null;
  return (
    <Text mt={mt} style={{ whiteSpace: 'pre-wrap' }}>
      {topic}
    </Text>
  );
}

export default ConversationTopic;
