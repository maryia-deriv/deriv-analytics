import { Growthbook } from './growthbook'
import { RudderStack } from './rudderstack'
import { TCoreAttributes, TEvents } from './types'

type Options = {
    growthbookKey?: string
    growthbookDecryptionKey?: string
    rudderstackKey: string
}

export function createAnalyticsInstance(options?: Options) {
    let _growthbook: Growthbook,
        _rudderstack: RudderStack,
        core_data: Partial<TCoreAttributes> = {},
        cta_buttons: Record<keyof TEvents, boolean> | {} = {},
        offline_cache: any = {}

    let interval = setInterval(() => {
        if (Object.keys(cta_buttons).length > 0) clearInterval(interval)
        else cta_buttons = getFeatureValue('tracking-buttons-config', {})
    }, 1000)

    const initialise = ({ growthbookKey, growthbookDecryptionKey, rudderstackKey }: Options) => {
        _rudderstack = RudderStack.getRudderStackInstance(rudderstackKey)
        if (growthbookKey && growthbookDecryptionKey) {
            _growthbook = Growthbook.getGrowthBookInstance(growthbookKey, growthbookDecryptionKey)
        }
    }

    const setAttributes = ({
        country,
        user_language,
        device_language,
        device_type,
        account_type,
        user_id,
        app_id,
        utm_source,
        utm_medium,
        utm_campaign,
        is_authorised,
    }: TCoreAttributes) => {
        if (!_growthbook && !_rudderstack) return
        const user_identity = user_id ? user_id : getId()

        // Check if we have Growthbook instance
        if (_growthbook) {
            _growthbook.setAttributes({
                id: user_identity || getId(),
                country,
                user_language,
                device_language,
                device_type,
                utm_source,
                utm_medium,
                utm_campaign,
                is_authorised,
            })
        }

        core_data = {
            ...(user_language !== undefined && { user_language }),
            ...(account_type !== undefined && { account_type }),
            ...(app_id !== undefined && { app_id }),
            ...(device_type !== undefined && { device_type }),
            ...(user_identity !== undefined && { user_identity }),
        }
    }

    const getFeatureState = (id: string) => _growthbook?.getFeatureState(id)?.experimentResult?.name
    const getFeatureValue = <T>(id: string, defaultValue?: T) => _growthbook?.getFeatureValue(id, defaultValue)
    const isFeatureOn = (key: string) => _growthbook?.isOn(key)
    const setUrl = (href: string) => _growthbook?.setUrl(href)
    const getId = () => _rudderstack?.getUserId() || _rudderstack?.getAnonymousId()
    /**
     * Pushes page view event to Rudderstack
     *
     * @param curret_page The name or URL of the current page to track the page view event
     */
    const pageView = (current_page: string, platform = 'Deriv App') => {
        if (!_rudderstack) return

        _rudderstack?.pageView(current_page, platform, getId())
    }

    const identifyEvent = () => {
        if (core_data?.user_identity && _rudderstack) {
            _rudderstack?.identifyEvent(core_data?.user_identity, { language: core_data?.user_language || 'en' })
        }
    }

    const reset = () => {
        if (!_rudderstack) return

        _rudderstack?.reset()
    }

    const trackEvent = <T extends keyof TEvents>(event: T, analytics_data: TEvents[T]) => {
        if (!_rudderstack) return

        if (navigator.onLine) {
            if (Object.keys(offline_cache).length > 0) {
                Object.keys(offline_cache).map(cache => {
                    _rudderstack.track(offline_cache[cache].event, offline_cache[cache].payload)
                    delete offline_cache[cache]
                })
            }
            if (event in cta_buttons) {
                // @ts-ignore
                cta_buttons[event] && _rudderstack?.track(event, { ...core_data, ...analytics_data })
            } else _rudderstack?.track(event, { ...core_data, ...analytics_data })
        } else {
            offline_cache[event + analytics_data.action] = { event, payload: { ...core_data, ...analytics_data } }
        }
    }

    const getInstances = () => ({ ab: _growthbook, tracking: _rudderstack })

    return {
        initialise,
        setAttributes,
        identifyEvent,
        getFeatureState,
        getFeatureValue,
        isFeatureOn,
        setUrl,
        getId,
        trackEvent,
        getInstances,
        pageView,
        reset,
    }
}

export const Analytics = createAnalyticsInstance()
