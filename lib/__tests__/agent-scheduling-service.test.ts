import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    AgentSchedulingService,
    ScheduledJob,
    EventMonitor,
    CronExpressionValidator
} from '../agent-scheduling-service'
import {
    Agent,
    AgentStatus,
    Schedule,
    EventTrigger
} from '../types'

describe('AgentSchedulingService', () => {
    let service: AgentSchedulingService
    let mockConsoleLog: any
    let mockConsoleError: any

    beforeEach(() => {
        service = new AgentSchedulingService()
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { })
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        service.destroy()
        mockConsoleLog.mockRestore()
        mockConsoleError.mockRestore()
    })

    describe('Schedule Management', () => {
        it('should schedule agent with interval-based recurring schedule', () => {
            const agent: Agent = {
                id: 'test-agent-1',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    interval: 3600 // 1 hour
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const job = service.getScheduledJob(agent.id)
            expect(job).toBeDefined()
            expect(job?.agentId).toBe(agent.id)
            expect(job?.schedule.type).toBe('recurring')
            expect(job?.schedule.interval).toBe(3600)
            expect(job?.isActive).toBe(true)
            expect(job?.executionCount).toBe(0)
        })

        it('should schedule agent with cron expression', () => {
            const agent: Agent = {
                id: 'test-agent-2',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    cronExpression: '0 9 * * *' // Daily at 9 AM
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const job = service.getScheduledJob(agent.id)
            expect(job).toBeDefined()
            expect(job?.schedule.cronExpression).toBe('0 9 * * *')
        })

        it('should schedule one-time agent', () => {
            const startTime = new Date(Date.now() + 60000) // 1 minute from now
            const agent: Agent = {
                id: 'test-agent-3',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'one-time',
                    startTime
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const job = service.getScheduledJob(agent.id)
            expect(job).toBeDefined()
            expect(job?.schedule.type).toBe('one-time')
            expect(job?.nextExecution?.getTime()).toBe(startTime.getTime())
        })

        it('should unschedule agent', () => {
            const agent: Agent = {
                id: 'test-agent-4',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'one-time'
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)
            expect(service.getScheduledJob(agent.id)).toBeDefined()

            service.unscheduleAgent(agent.id)
            expect(service.getScheduledJob(agent.id)).toBeNull()
        })

        it('should replace existing schedule when rescheduling agent', () => {
            const agent: Agent = {
                id: 'test-agent-5',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    interval: 3600
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)
            const firstJob = service.getScheduledJob(agent.id)
            expect(firstJob?.schedule.interval).toBe(3600)

            // Update schedule
            agent.schedule = {
                type: 'recurring',
                interval: 7200 // 2 hours
            }

            service.scheduleAgent(agent)
            const secondJob = service.getScheduledJob(agent.id)
            expect(secondJob?.schedule.interval).toBe(7200)
        })
    })

    describe('Event Trigger System', () => {
        it('should set up event monitors for agents with triggers', () => {
            const agent: Agent = {
                id: 'test-agent-6',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'event-driven'
                },
                triggers: [{
                    type: 'price',
                    condition: {
                        operator: 'gt',
                        value: 100
                    },
                    parameters: {}
                }],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const monitor = service.getEventMonitor(agent.id)
            expect(monitor).toBeDefined()
            expect(monitor?.agentId).toBe(agent.id)
            expect(monitor?.triggers).toHaveLength(1)
            expect(monitor?.triggers[0].type).toBe('price')
            expect(monitor?.isActive).toBe(true)
        })

        it('should initialize trigger states for all triggers', () => {
            const agent: Agent = {
                id: 'test-agent-7',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'event-driven'
                },
                triggers: [
                    {
                        type: 'price',
                        condition: { operator: 'gt', value: 100 },
                        parameters: {}
                    },
                    {
                        type: 'balance',
                        condition: { operator: 'lt', value: 1000 },
                        parameters: {}
                    }
                ],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const monitor = service.getEventMonitor(agent.id)
            expect(monitor?.triggerStates.size).toBe(2)
            expect(monitor?.triggerStates.has('price')).toBe(true)
            expect(monitor?.triggerStates.has('balance')).toBe(true)
        })

        it('should clean up event monitors when unscheduling', () => {
            const agent: Agent = {
                id: 'test-agent-8',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'event-driven'
                },
                triggers: [{
                    type: 'price',
                    condition: { operator: 'gt', value: 100 },
                    parameters: {}
                }],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)
            expect(service.getEventMonitor(agent.id)).toBeDefined()

            service.unscheduleAgent(agent.id)
            expect(service.getEventMonitor(agent.id)).toBeNull()
        })
    })

    describe('Cron Expression Parsing', () => {
        it('should calculate next execution for simple cron expressions', () => {
            const agent: Agent = {
                id: 'test-agent-9',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    cronExpression: '30 14 * * *' // Daily at 2:30 PM
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const job = service.getScheduledJob(agent.id)
            expect(job?.nextExecution).toBeDefined()
            expect(job?.nextExecution?.getHours()).toBe(14)
            expect(job?.nextExecution?.getMinutes()).toBe(30)
        })

        it('should handle wildcard cron expressions', () => {
            const agent: Agent = {
                id: 'test-agent-10',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    cronExpression: '0 * * * *' // Every hour
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            service.scheduleAgent(agent)

            const job = service.getScheduledJob(agent.id)
            expect(job?.nextExecution).toBeDefined()
            expect(job?.nextExecution?.getMinutes()).toBe(0)
        })

        it('should throw error for invalid cron expressions', () => {
            const agent: Agent = {
                id: 'test-agent-11',
                name: 'Test Agent',
                description: 'Test',
                workflowId: 'test-workflow',
                schedule: {
                    type: 'recurring',
                    cronExpression: 'invalid cron'
                },
                triggers: [],
                status: AgentStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                owner: 'test-user'
            }

            expect(() => service.scheduleAgent(agent)).toThrow()
        })
    })

    describe('Query Methods', () => {
        beforeEach(() => {
            // Set up multiple agents for testing
            const agents: Agent[] = [
                {
                    id: 'agent-1',
                    name: 'Agent 1',
                    description: 'Test',
                    workflowId: 'workflow-1',
                    schedule: { type: 'one-time' },
                    triggers: [],
                    status: AgentStatus.ACTIVE,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    owner: 'user-1'
                },
                {
                    id: 'agent-2',
                    name: 'Agent 2',
                    description: 'Test',
                    workflowId: 'workflow-2',
                    schedule: { type: 'recurring', interval: 3600 },
                    triggers: [{
                        type: 'price',
                        condition: { operator: 'gt', value: 100 },
                        parameters: {}
                    }],
                    status: AgentStatus.ACTIVE,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    owner: 'user-2'
                }
            ]

            agents.forEach(agent => service.scheduleAgent(agent))
        })

        it('should get all scheduled jobs', () => {
            const jobs = service.getAllScheduledJobs()
            expect(jobs).toHaveLength(2)
            expect(jobs.map(j => j.agentId)).toEqual(['agent-1', 'agent-2'])
        })

        it('should get active event monitors', () => {
            const monitors = service.getActiveEventMonitors()
            expect(monitors).toHaveLength(1) // Only agent-2 has triggers
            expect(monitors[0].agentId).toBe('agent-2')
        })

        it('should return null for non-existent scheduled job', () => {
            const job = service.getScheduledJob('non-existent')
            expect(job).toBeNull()
        })

        it('should return null for non-existent event monitor', () => {
            const monitor = service.getEventMonitor('non-existent')
            expect(monitor).toBeNull()
        })
    })
})

describe('CronExpressionValidator', () => {
    describe('Validation', () => {
        it('should validate correct cron expressions', () => {
            const validExpressions = [
                '0 0 * * *',     // Daily at midnight
                '30 14 * * *',   // Daily at 2:30 PM
                '0 */2 * * *',   // Every 2 hours
                '15 10 1 * *',   // 10:15 AM on the 1st of every month
                '0 9 * * 1-5',   // 9 AM on weekdays
                '*/15 * * * *'   // Every 15 minutes
            ]

            validExpressions.forEach(expr => {
                const result = CronExpressionValidator.validate(expr)
                expect(result.isValid).toBe(true)
                expect(result.error).toBeUndefined()
            })
        })

        it('should reject invalid cron expressions', () => {
            const invalidExpressions = [
                '0 0 * *',       // Too few parts
                '0 0 * * * *',   // Too many parts
                '60 0 * * *',    // Invalid minute (>59)
                '0 25 * * *',    // Invalid hour (>23)
                '0 0 32 * *',    // Invalid day (>31)
                '0 0 * 13 *',    // Invalid month (>12)
                '0 0 * * 8',     // Invalid day of week (>7)
                'invalid format' // Completely invalid
            ]

            invalidExpressions.forEach(expr => {
                const result = CronExpressionValidator.validate(expr)
                expect(result.isValid).toBe(false)
                expect(result.error).toBeDefined()
            })
        })

        it('should validate cron fields with ranges', () => {
            const result = CronExpressionValidator.validate('0 9-17 * * 1-5')
            expect(result.isValid).toBe(true)
        })

        it('should validate cron fields with lists', () => {
            const result = CronExpressionValidator.validate('0 9,12,15 * * *')
            expect(result.isValid).toBe(true)
        })

        it('should validate cron fields with step values', () => {
            const result = CronExpressionValidator.validate('*/5 * * * *')
            expect(result.isValid).toBe(true)
        })

        it('should reject invalid ranges', () => {
            const result = CronExpressionValidator.validate('0 17-9 * * *') // Invalid range
            expect(result.isValid).toBe(false)
        })

        it('should reject invalid step values', () => {
            const result = CronExpressionValidator.validate('*/0 * * * *') // Invalid step
            expect(result.isValid).toBe(false)
        })
    })

    describe('Next Execution Calculation', () => {
        it('should calculate next execution for cron expression', () => {
            const cronExpression = '0 9 * * *' // Daily at 9 AM
            const nextExecution = CronExpressionValidator.getNextExecution(cronExpression)

            expect(nextExecution).toBeInstanceOf(Date)
            expect(nextExecution.getHours()).toBe(9)
            expect(nextExecution.getMinutes()).toBe(0)
        })

        it('should calculate next execution from specific date', () => {
            const cronExpression = '30 14 * * *' // Daily at 2:30 PM
            const fromDate = new Date('2024-01-01T10:00:00Z')
            const nextExecution = CronExpressionValidator.getNextExecution(cronExpression, fromDate)

            expect(nextExecution.getHours()).toBe(14)
            expect(nextExecution.getMinutes()).toBe(30)
        })
    })
})

describe('Trigger Condition Evaluation', () => {
    let service: AgentSchedulingService
    let mockConsoleLog: any

    beforeEach(() => {
        service = new AgentSchedulingService()
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { })
    })

    afterEach(() => {
        service.destroy()
        mockConsoleLog.mockRestore()
    })

    it('should evaluate greater than condition', () => {
        const agent: Agent = {
            id: 'test-agent-condition',
            name: 'Test Agent',
            description: 'Test',
            workflowId: 'test-workflow',
            schedule: { type: 'event-driven' },
            triggers: [{
                type: 'price',
                condition: { operator: 'gt', value: 100 },
                parameters: {}
            }],
            status: AgentStatus.ACTIVE,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            owner: 'test-user'
        }

        service.scheduleAgent(agent)

        // Simulate trigger evaluation with price data
        const monitor = service.getEventMonitor(agent.id)!
        const trigger = monitor.triggers[0]

        // Use private method through type assertion for testing
        const evaluateCondition = (service as any).evaluateCondition.bind(service)

        expect(evaluateCondition(trigger.condition, 150)).toBe(true)  // 150 > 100
        expect(evaluateCondition(trigger.condition, 50)).toBe(false)  // 50 < 100
        expect(evaluateCondition(trigger.condition, 100)).toBe(false) // 100 = 100
    })

    it('should evaluate less than condition', () => {
        const service = new AgentSchedulingService()
        const evaluateCondition = (service as any).evaluateCondition.bind(service)

        const condition = { operator: 'lt' as const, value: 100 }

        expect(evaluateCondition(condition, 50)).toBe(true)   // 50 < 100
        expect(evaluateCondition(condition, 150)).toBe(false) // 150 > 100
        expect(evaluateCondition(condition, 100)).toBe(false) // 100 = 100

        service.destroy()
    })

    it('should evaluate equality condition with tolerance', () => {
        const service = new AgentSchedulingService()
        const evaluateCondition = (service as any).evaluateCondition.bind(service)

        const condition = { operator: 'eq' as const, value: 100, tolerance: 5 }

        expect(evaluateCondition(condition, 100)).toBe(true) // Exact match
        expect(evaluateCondition(condition, 103)).toBe(true) // Within tolerance
        expect(evaluateCondition(condition, 97)).toBe(true)  // Within tolerance
        expect(evaluateCondition(condition, 110)).toBe(false) // Outside tolerance

        service.destroy()
    })
})