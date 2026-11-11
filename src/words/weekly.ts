import { WordList } from './types';

/**
 * This week's words from school. Replace the list each week.
 * Every sentence needs exactly one ___ where the word goes.
 */
export const THIS_WEEK: WordList = {
  title: 'Tricky words',
  words: [
    { word: "couldn't", sentence: 'I ___ find my other shoe this morning.', parts: "could + n't" },
    { word: "shouldn't", sentence: 'You ___ touch a hot stove.', parts: "should + n't" },
    { word: "wouldn't", sentence: 'The cat ___ come out from under the bed.', parts: "would + n't" },
    { word: 'relative', sentence: 'An aunt or a cousin is a ___.', parts: 'rel · a · tive' },
    { word: 'probably', sentence: 'Bring a coat because it will ___ rain.', parts: 'prob · a · bly' },
    { word: 'solution', sentence: 'We worked together to find a ___ to the problem.', parts: 'so · lu · tion' },
    { word: 'nothing', sentence: 'The box was empty. There was ___ inside.', parts: 'no + thing' },
  ],
};
