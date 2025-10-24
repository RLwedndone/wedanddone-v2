import { NavigateFunction } from "react-router-dom";
import { saveRankerProgress } from "./saveRankerProgress";

export const goToNextScreen = (
  navigate: NavigateFunction,
  screenList: string[],
  currentIndex: number
) => {
  const nextIndex = currentIndex + 1;
  const nextPath = screenList[nextIndex];

  if (nextPath) {
    saveRankerProgress(`/venue-ranker/${nextPath}`);
    navigate("/venue-ranker", {
      state: {
        screenList,
        currentIndex: nextIndex,
      },
    });
  }
};