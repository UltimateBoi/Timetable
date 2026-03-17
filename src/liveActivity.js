import { LiveActivity } from 'capacitor-live-activity';

let currentActivityId = null;

export async function updateLiveActivityData(status) {
    if (!status || !status.inPeriod) {
        if (currentActivityId) {
            try {
                await LiveActivity.endActivity({ id: currentActivityId });
                currentActivityId = null;
            } catch (e) {
                console.error("Could not end activity", e);
            }
        }
        return;
    }

    const title = status.lesson ? status.lesson.subject : (status.isLunch ? 'Lunch' : 'Free Period');
    const subtitle = `${status.period.start} - ${status.period.end}`;
    const periodLabel = status.period.label;
    
    // Convert to content state
    const contentState = {
        title: title,
        subtitle: subtitle,
        period: periodLabel,
        percentage: Math.round(status.progress.percentage).toString() + "%",
        remaining: `Left: ${status.progress.totalMinutes - status.progress.elapsedMinutes}m`
    };

    if (!currentActivityId) {
        try {
            const { id } = await LiveActivity.startActivity({
                attributes: {
                    type: 'lesson',
                },
                contentState: contentState
            });
            currentActivityId = id;
        } catch (e) {
            console.error("Could not start live activity", e);
        }
    } else {
        try {
            await LiveActivity.updateActivity({
                id: currentActivityId,
                contentState: contentState
            });
        } catch (e) {
            console.error("Could not update live activity", e);
        }
    }
}
