#!/usr/bin/env node

/**
 * Comprehensive Validation Test Runner
 * 
 * This script runs all validation tests and generates a comprehensive report
 * covering parameter validation, workflow validation, UI validation, and performance benchmarks.
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'

interface TestResult {
    suite: string
    passed: number
    failed: number
    skipped: number
    duration: number
    coverage?: number
}

interface TestReport {
    timestamp: string
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalSkipped: number
    totalDuration: number
    overallCoverage: number
    suites: TestResult[]
    performanceMetrics: Record<string, number>
    recommendations: string[]
}

class ComprehensiveTestRunner {
    private results: TestResult[] = []
    private performanceMetrics: Record<string, number> = {}

    async runAllTests(): Promise<TestReport> {
        console.log('🚀 Starting Comprehensive Validation Test Suite...\n')

        // Run test suites in order
        await this.runTestSuite('Parameter Validation Core', [
            'lib/__tests__/parameter-validator.test.ts'
        ])

        await this.runTestSuite('Enhanced Workflow Validation', [
            'lib/__tests__/enhanced-workflow-validator.test.ts'
        ])

        await this.runTestSuite('Parameter Configuration UI', [
            'components/__tests__/parameter-config-panel.test.tsx',
            'components/__tests__/parameter-input.test.tsx'
        ])

        await this.runTestSuite('Workflow Builder Integration', [
            'components/__tests__/workflow-builder-validation-integration.test.tsx'
        ])

        await this.runTestSuite('Execution Validation End-to-End', [
            'lib/__tests__/execution-validation-end-to-end.test.ts'
        ])

        await this.runTestSuite('Comprehensive Parameter Validation', [
            'lib/__tests__/comprehensive-parameter-validation.test.ts'
        ])

        await this.runTestSuite('Comprehensive UI Validation', [
            'components/__tests__/comprehensive-ui-validation.test.tsx'
        ])

        await this.runTestSuite('End-to-End Workflow Validation', [
            'lib/__tests__/end-to-end-workflow-validation.test.ts'
        ])

        await this.runTestSuite('Performance Benchmarks', [
            'lib/__tests__/validation-performance-benchmarks.test.ts'
        ])

        return this.generateReport()
    }

    private async runTestSuite(suiteName: string, testFiles: string[]): Promise<void> {
        console.log(`📋 Running ${suiteName}...`)

        const startTime = Date.now()
        let passed = 0
        let failed = 0
        let skipped = 0

        try {
            // Run tests with vitest
            const testPattern = testFiles.join(' ')
            const command = `npx vitest run ${testPattern} --reporter=json --coverage`

            const output = execSync(command, {
                encoding: 'utf-8',
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            })

            // Parse vitest JSON output
            const lines = output.split('\n').filter(line => line.trim())
            const jsonLine = lines.find(line => line.startsWith('{'))

            if (jsonLine) {
                const result = JSON.parse(jsonLine)
                passed = result.numPassedTests || 0
                failed = result.numFailedTests || 0
                skipped = result.numPendingTests || 0
            }

            console.log(`  ✅ ${passed} passed, ❌ ${failed} failed, ⏭️ ${skipped} skipped`)

        } catch (error) {
            console.log(`  ❌ Test suite failed: ${error}`)
            failed = 1
        }

        const duration = Date.now() - startTime

        this.results.push({
            suite: suiteName,
            passed,
            failed,
            skipped,
            duration
        })

        console.log(`  ⏱️ Completed in ${duration}ms\n`)
    }

    private generateReport(): TestReport {
        const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0)
        const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
        const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
        const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0)
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)

        const report: TestReport = {
            timestamp: new Date().toISOString(),
            totalTests,
            totalPassed,
            totalFailed,
            totalSkipped,
            totalDuration,
            overallCoverage: 0, // Would be calculated from coverage reports
            suites: this.results,
            performanceMetrics: this.performanceMetrics,
            recommendations: this.generateRecommendations()
        }

        this.saveReport(report)
        this.printSummary(report)

        return report
    }

    private generateRecommendations(): string[] {
        const recommendations: string[] = []

        // Analyze results and provide recommendations
        const failedSuites = this.results.filter(r => r.failed > 0)
        if (failedSuites.length > 0) {
            recommendations.push(`🔧 Fix failing tests in: ${failedSuites.map(s => s.suite).join(', ')}`)
        }

        const slowSuites = this.results.filter(r => r.duration > 10000) // > 10 seconds
        if (slowSuites.length > 0) {
            recommendations.push(`⚡ Optimize performance for: ${slowSuites.map(s => s.suite).join(', ')}`)
        }

        const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0)
        if (totalTests < 100) {
            recommendations.push('📈 Consider adding more test cases to improve coverage')
        }

        if (recommendations.length === 0) {
            recommendations.push('🎉 All validation tests are passing! Great job!')
            recommendations.push('🔍 Consider adding edge case tests for even better coverage')
            recommendations.push('📊 Monitor performance metrics over time')
        }

        return recommendations
    }

    private saveReport(report: TestReport): void {
        const reportPath = join(process.cwd(), 'validation-test-report.json')
        writeFileSync(reportPath, JSON.stringify(report, null, 2))
        console.log(`📄 Test report saved to: ${reportPath}`)
    }

    private printSummary(report: TestReport): void {
        console.log('\n' + '='.repeat(60))
        console.log('📊 COMPREHENSIVE VALIDATION TEST SUMMARY')
        console.log('='.repeat(60))

        console.log(`\n📈 Overall Results:`)
        console.log(`  Total Tests: ${report.totalTests}`)
        console.log(`  Passed: ${report.totalPassed} (${((report.totalPassed / report.totalTests) * 100).toFixed(1)}%)`)
        console.log(`  Failed: ${report.totalFailed} (${((report.totalFailed / report.totalTests) * 100).toFixed(1)}%)`)
        console.log(`  Skipped: ${report.totalSkipped} (${((report.totalSkipped / report.totalTests) * 100).toFixed(1)}%)`)
        console.log(`  Duration: ${(report.totalDuration / 1000).toFixed(2)}s`)

        console.log(`\n📋 Suite Breakdown:`)
        report.suites.forEach(suite => {
            const total = suite.passed + suite.failed + suite.skipped
            const passRate = total > 0 ? ((suite.passed / total) * 100).toFixed(1) : '0.0'
            const status = suite.failed > 0 ? '❌' : '✅'

            console.log(`  ${status} ${suite.suite}:`)
            console.log(`     ${suite.passed}/${total} passed (${passRate}%) - ${suite.duration}ms`)
        })

        if (Object.keys(report.performanceMetrics).length > 0) {
            console.log(`\n⚡ Performance Metrics:`)
            Object.entries(report.performanceMetrics).forEach(([metric, value]) => {
                console.log(`  ${metric}: ${value}ms`)
            })
        }

        console.log(`\n💡 Recommendations:`)
        report.recommendations.forEach(rec => {
            console.log(`  ${rec}`)
        })

        console.log('\n' + '='.repeat(60))

        if (report.totalFailed === 0) {
            console.log('🎉 ALL VALIDATION TESTS PASSED! 🎉')
        } else {
            console.log(`⚠️  ${report.totalFailed} tests failed. Please review and fix.`)
        }

        console.log('='.repeat(60) + '\n')
    }
}

// Run the comprehensive test suite
async function main() {
    const runner = new ComprehensiveTestRunner()

    try {
        const report = await runner.runAllTests()

        // Exit with error code if tests failed
        if (report.totalFailed > 0) {
            process.exit(1)
        }

        process.exit(0)
    } catch (error) {
        console.error('❌ Test runner failed:', error)
        process.exit(1)
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    main()
}

export { ComprehensiveTestRunner }
export type { TestReport, TestResult }